import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS, 
    }
})


export const sendOtPEmail = async (to:string, otp:string) => {
    const mailOption = {
        from: `"Food APP" <${process.env.EMAIL_USER}`,
        to, 
        subject: "Your OTP code",
        text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
        html: `<p>Your OTP code is <b>${otp}</b>. It will expire in 10 minutes.</p>`,
    }

    await transporter.sendMail(mailOption)
}