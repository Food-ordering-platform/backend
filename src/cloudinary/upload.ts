import cloudinary from "./index"; // import the configured cloudinary

export async function uploadMenuImage(filePath: string) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "restaurant-menu",
    use_filename: true,
    unique_filename: false,
  });
  return result.secure_url; // this URL goes into MenuItem.imageUrl
}
