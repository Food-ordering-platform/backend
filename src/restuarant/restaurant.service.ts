import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient()

export class RestaurantService{
    static async getAllRestaurant(){
        return await prisma.restaurant.findMany({
            select:{
                id:true,
                name:true,
                
            }
        })
    }
}