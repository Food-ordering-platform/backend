import { channel } from "diagnostics_channel";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

export const sendPushNotification = async (
  pushToken: string,
  title: string,
  body: string,
  data: any = {}
) => {
    if(!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push Token${pushToken} is not a valid Expo push Token`)
        return;
    }

    const messages =[{
        to:pushToken,
        sound:'default',
        title:title,
        body:body,
        data:data,
        priority:'high', // Critical for waking up Android devices
        channelId:'orders' // Matches the channel we will create on Frontend
    }]

    try{
        const chunks = expo.chunkPushNotifications(messages as any)
        for (let chunk of chunks){
            await expo.sendPushNotificationsAsync(chunk)
        }
        console.log("✅ Push Sent to:", pushToken)
    }
    catch(err){
        console.error("❌ Push Error:",err)
    }
};

