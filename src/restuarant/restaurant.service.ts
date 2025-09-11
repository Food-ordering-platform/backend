import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

export class RestaurantService {
  static async getAllRestaurant() {
    return await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        imageUrl: true,
        deliveryTime: true,
        deliveryFee: true,
        minimumOrder: true,
        isOpen: true,
      },
    });
  }

  //Get a single restaurant by ID
  static async getRestuarantbyId(id:string){
    return await prisma.restaurant.findUnique({
        where: {id},
        include:{
            menuItems:true
        }
    })
  }
}
