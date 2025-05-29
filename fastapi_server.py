@app.post("/predict_video")
async def predict_video(file: UploadFile = File(...)):
    logger.info("Starting video prediction endpoint")
    
    # Check model and dependencies
    try:
        if any(x is None for x in [model_loaded, class_names_loaded, device_loaded, transform_loaded]):
            logger.error("Model or dependencies not loaded")
            raise HTTPException(status_code=503, detail="Model or dependencies not loaded.")
        if hands_detector_instance is None:
            logger.error("MediaPipe Hands not available")
            raise HTTPException(status_code=503, detail="MediaPipe Hands not available.")
    except Exception as e:
        logger.error(f"Error checking dependencies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking dependencies: {str(e)}")

    # Create debug directory
    try:
        request_debug_dir = os.path.join(SERVER_DEBUG_ROOT_DIR, f"video_request_{int(time.time())}")
        os.makedirs(request_debug_dir, exist_ok=True)
        temp_video_path = os.path.join(request_debug_dir, "uploaded_video.mp4")
        logger.info(f"Created debug directory: {request_debug_dir}")
    except Exception as e:
        logger.error(f"Error creating debug directory: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating debug directory: {str(e)}")

    # Save uploaded video
    try:
        video_data = await file.read()
        with open(temp_video_path, "wb") as f:
            f.write(video_data)
        logger.info(f"Video saved to {temp_video_path}")
    except Exception as e:
        logger.error(f"Error saving video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving video: {str(e)}")
    finally:
        await file.close()

    # Open video file
    try:
        cap = cv2.VideoCapture(temp_video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video file: {temp_video_path}")
            raise HTTPException(status_code=400, detail="Could not open video file.")
    except Exception as e:
        logger.error(f"Error opening video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error opening video: {str(e)}")

    # Get video properties
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        logger.info(f"Video properties - FPS: {fps}, Total frames: {total_frames}, Duration: {duration:.2f}s")
    except Exception as e:
        logger.error(f"Error getting video properties: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting video properties: {str(e)}")

    # Read frames
    try:
        all_frames = []
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame is None:
                logger.warning(f"Received None frame at count {frame_count}")
                continue
            all_frames.append(frame)
            frame_count += 1
        
        cap.release()
        logger.info(f"Successfully read {frame_count} frames")
    except Exception as e:
        logger.error(f"Error reading frames: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading frames: {str(e)}")

    if not all_frames:
        logger.error("No frames extracted from video")
        raise HTTPException(status_code=400, detail="No frames extracted from video.")

    # Process frames for motion detection
    try:
        motion_segments = []
        prev_frame = None
        motion_threshold = 5  # Very low threshold
        min_segment_frames = 1  # Minimum 1 frame
        current_segment = []
        motion_detected = False
        consecutive_motion_frames = 0
        motion_values = []  # Store motion values for analysis

        logger.info(f"Starting motion analysis - Threshold: {motion_threshold}, Min frames: {min_segment_frames}")

        for frame_idx, frame in enumerate(all_frames):
            if prev_frame is not None:
                try:
                    # Calculate frame difference
                    diff = cv2.absdiff(frame, prev_frame)
                    motion = np.mean(diff)
                    motion_values.append(motion)
                    
                    # Save debug image for motion
                    motion_debug = cv2.cvtColor(diff, cv2.COLOR_GRAY2BGR)
                    cv2.imwrite(os.path.join(request_debug_dir, f"motion_{frame_idx:04d}.png"), motion_debug)
                    
                    if motion > motion_threshold:
                        motion_detected = True
                        consecutive_motion_frames += 1
                        current_segment.append(frame)
                        logger.debug(f"Motion detected at frame {frame_idx} - value: {motion:.2f}")
                    elif motion_detected and consecutive_motion_frames >= min_segment_frames:
                        logger.info(f"Segment detected at frame {frame_idx} with {len(current_segment)} frames")
                        motion_segments.append(current_segment)
                        current_segment = []
                        motion_detected = False
                        consecutive_motion_frames = 0
                    else:
                        if len(current_segment) > 0:
                            logger.info(f"Discarding segment at frame {frame_idx} - too short ({len(current_segment)} frames)")
                        current_segment = []
                        motion_detected = False
                        consecutive_motion_frames = 0
                except Exception as e:
                    logger.error(f"Error processing frame {frame_idx}: {str(e)}")
                    continue
            
            prev_frame = frame

        # Add the last segment if it's long enough
        if len(current_segment) >= min_segment_frames:
            logger.info(f"Adding final segment with {len(current_segment)} frames")
            motion_segments.append(current_segment)

        # Analyze motion values
        if motion_values:
            avg_motion = sum(motion_values) / len(motion_values)
            max_motion = max(motion_values)
            min_motion = min(motion_values)
            logger.info(f"Motion analysis - Avg: {avg_motion:.2f}, Max: {max_motion:.2f}, Min: {min_motion:.2f}")

        logger.info(f"Detected {len(motion_segments)} potential sign segments")
    except Exception as e:
        logger.error(f"Error in motion detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in motion detection: {str(e)}")

    if not motion_segments:
        logger.error("No motion segments detected")
        # Instead of failing, create a single segment from the entire video
        logger.info("Creating single segment from entire video")
        motion_segments = [all_frames]

    # Process segments for prediction
    try:
        detected_signs = []
        for segment_idx, segment_frames in enumerate(motion_segments):
            try:
                logger.info(f"Processing segment {segment_idx + 1} with {len(segment_frames)} frames")
                
                # Select frames for this segment
                indices = np.linspace(0, len(segment_frames) - 1, config.SEQUENCE_LENGTH, dtype=int)
                selected_frames = [segment_frames[i] for i in indices]

                # Process frames
                processed_tensors = []
                for idx, bgr_frame in enumerate(selected_frames):
                    if bgr_frame is None:
                        continue
                    try:
                        # Save original frame
                        cv2.imwrite(os.path.join(request_debug_dir, f"seg{segment_idx}_{idx:02d}_original.png"), bgr_frame)
                        
                        # Rotate frame
                        bgr_frame = cv2.rotate(bgr_frame, cv2.ROTATE_90_CLOCKWISE)
                        cv2.imwrite(os.path.join(request_debug_dir, f"seg{segment_idx}_{idx:02d}_rotated.png"), bgr_frame)
                        
                        # Convert to RGB
                        rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
                        cv2.imwrite(os.path.join(request_debug_dir, f"seg{segment_idx}_{idx:02d}_rgb.png"), rgb_frame)
                        
                        # Apply MediaPipe mask
                        masked_gray = apply_mediapipe_mask_and_grayscale_internal(rgb_frame)
                        cv2.imwrite(os.path.join(request_debug_dir, f"seg{segment_idx}_{idx:02d}_masked_gray.png"), masked_gray)
                        
                        # Transform to tensor
                        frame_tensor = transform_loaded(masked_gray)
                        processed_tensors.append(frame_tensor)
                        
                    except Exception as e:
                        logger.error(f"Error processing frame {idx} in segment {segment_idx}: {str(e)}")
                        continue

                if not processed_tensors:
                    logger.error(f"No valid frames in segment {segment_idx}")
                    continue

                if len(processed_tensors) < config.SEQUENCE_LENGTH:
                    pad_needed = config.SEQUENCE_LENGTH - len(processed_tensors)
                    padding = [torch.zeros_like(processed_tensors[0]) for _ in range(pad_needed)]
                    processed_tensors += padding

                # Predict for this segment
                input_tensor = torch.stack(processed_tensors).unsqueeze(0).to(device_loaded)
                with torch.no_grad():
                    outputs = model_loaded(input_tensor)
                    probabilities = torch.softmax(outputs, dim=1)
                    confidence, pred_idx = torch.max(probabilities, 1)

                predicted_class = class_names_loaded[pred_idx.item()]
                confidence_val = confidence.item()
                logger.info(f"Segment {segment_idx + 1} prediction: {predicted_class} (confidence: {confidence_val:.2f})")

                # Only add if confidence is high enough
                if confidence_val > 0.05:  # Very low confidence threshold
                    detected_signs.append({
                        "predicted_class": predicted_class,
                        "confidence_score": confidence_val
                    })
            except Exception as e:
                logger.error(f"Error processing segment {segment_idx}: {str(e)}")
                continue

        if not detected_signs:
            logger.error("No signs detected with sufficient confidence")
            raise HTTPException(status_code=400, detail="No signs detected with sufficient confidence.")

        logger.info(f"Successfully detected {len(detected_signs)} signs")
        return {
            "detected_signs": detected_signs
        }
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error in prediction: {str(e)}") 