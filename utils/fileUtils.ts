import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

export const getCSVPath = () => {
  return `${FileSystem.documentDirectory}signs.csv`;
};

export const ensureCSVExists = async () => {
  try {
    const csvPath = getCSVPath();
    
    // Always recreate the CSV file to ensure correct data
    const csvContent = `label,arabic,french,video
1,واحد,un,1.mp4
2,اثنان,deux,2.mp4
3,ثلاثة,trois,3.mp4
4,أربعة,quatre,4.mp4
5,خمسة,cinq,5.mp4
6,ستة,six,6.mp4
7,سبعة,sept,7.mp4
8,ثمانية,huit,8.mp4
9,تسعة,neuf,9.mp4
10,عشرة,dix,10.mp4
11,أحد عشر,onze,11.mp4
9odem,في الامام,Devant,9odem.mp4
arjaa_ghodwa,ارجع غداً,reviens demain,arjaa_ghodwa.mp4
asslema,عسلامة,Salut,asslema.mp4
baladeya,بلدية,mairie,baladeya.mp4
chamel,شمال,nord,chamel.mp4
charaa,شارع,rue,charaa.mp4
chnoua_ismek,شنو اسمك,comment tu t'appelles,chnoua_ismek.mp4
cv, CV,CV,cv.mp4
dar,دار,maison,dar.mp4
hmd,الحمد لله,Dieu merci,hmd.mp4
janoub,جنوب,sud,janoub.mp4
kadech_omrek,قداش عمرك,quel âge as-tu,kadech_omrek.mp4
labes,لاباس,ça va,labes.mp4
madhmoun,مضمون ولادة,Certificat de naissance,madhmoun.mp4
madrasa,مدرسة,école,madrasa.mp4
nabeul,نابل,Nabeul,nabeul.mp4
sanna,سنة,année,sanna.mp4
sfer,صفر,zero,sfer.mp4
takra,تقرى,Tu etudier,takra.mp4
tekhdem,تخدم,tu travailles,tekhdem.mp4
win,وين,où,win.mp4
yamin,يمين,droite,yamin.mp4
ysar,يسار,gauche,ysar.mp4`;
    
    // Delete existing file if it exists
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(csvPath);
    }
    
    // Create new file with correct data
    await FileSystem.writeAsStringAsync(csvPath, csvContent);
    
    return csvPath;
  } catch (error) {
    console.error('Error ensuring CSV exists:', error);
    throw error;
  }
}; 