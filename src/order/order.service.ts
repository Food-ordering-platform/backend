import { custom } from "zod";
import { PrismaClient } from "../../generated/prisma";
import tr from "zod/v4/locales/tr.cjs";

const prisma = new PrismaClient();

export class OrderService {
    //Create an Order for a customer
  static async createOrder(
    customerId: string,
    restaurantId: string,
    totalAmount: number,
    deliveryAddress: string,
    items: {menuItemId: string, quantity: number, price:number}[]
  ) {
    return prisma.order.create({
        data:{
            customerId,
            restaurantId,
            totalAmount,
            deliveryAddress,
            items:{
                create:items.map((item) => ({
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    price:item.price,
                })),
            },
        },
        include:{
            items:{
                include: {menuItem:true}

            },
            restaurant:true,
            customer:true
        }
    })
  }


  //Get all order for a customer
  static async getOrdersbyCustomer(customerId: string){
    return prisma.order.findMany({
        where:{customerId},
        include:{
            items:{
                include:{
                    menuItem:true
                }
            },
            restaurant:true
        },
        orderBy:{
            createdAt:"desc"
        }
    })
  }

  //Get a given order byy ID

  static async getOrderbyId(orderId: string){
    return prisma.orderItem.findUnique({
        where:{id: orderId},
        include:{ menuItem:true}
  })
  }
}
