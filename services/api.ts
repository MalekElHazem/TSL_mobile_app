import axios from 'axios';


const API_URL = 'http://192.168.1.112:8000'; 

export interface PredictionResponse {
  detected_signs: Array<{
    predicted_class: string;
    confidence_score: number;
  }>;
}

export const api = {
  async predictSequence(frames: Blob[]): Promise<PredictionResponse> {
    const formData = new FormData();
    
    frames.forEach((frame, index) => {
      formData.append('files', frame, `frame_${index}.jpg`);
    });

    try {
      const response = await axios.post(`${API_URL}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error predicting sequence:', error);
      throw error;
    }
  },

  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/`);
      return response.status === 200;
    } catch (error) {
      console.error('Error checking server status:', error);
      return false;
    }
  },

  async predictVideo(videoData: FormData): Promise<PredictionResponse> {
    try {
      const response = await axios.post(`${API_URL}/predict_video`, videoData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error predicting video:', error);
      throw error;
    }
  }
}; 