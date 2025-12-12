import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

export class RestaurantService {
  //Create Restaurat
  static async createRestaurant(ownerId: string, data:any){
    //Check if user already has a restaurant
    const existing  = await prisma.restaurant.findUnique({where:{ownerId}})
    if(existing){
      throw new Error("You already have a restaurant")
    }
    return await prisma.restaurant.create({
      data:{
        ...data,
        ownerId,
        minimumOrder: data.minimumOrder || 0.0,
        isOpen: data.isOpen || true,
        
      }
    })
  }

  // Get all restaurants
  static async getAllRestaurant() {
    return await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        imageUrl: true,
        prepTime:true,
        minimumOrder: true,
        isOpen: true,
      },
    });
  }

  // Get a single restaurant by ID (with menu)
static async getRestaurantById(id: string) {
  return await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: {
        include: {
          menuItems: true, // nested items
        },
      },
      orders: {
        select: {
          id: true,
          customerId: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
          deliveryAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}



  // Update restaurant info
  static async updateRestaurant(id: string, data: any) {
    return await prisma.restaurant.update({
      where: { id },
      data,
    });
  }

  // ===== Menu Items =====
  // Get all menu items for a restaurant
  static async getMenuItems(restaurantId: string) {
    return await prisma.menuItem.findMany({
      where: { restaurantId }, include:{category:true}
    });
  }

  // Add a new menu item
  static async addMenuItem(restaurantId: string, data: any) {
    //1.Verify a restaurant exists
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurant not found");

  let categoryId = data.categoryId

  //2.If a category name is provided, find it or create one
  if(data.categoryName){
    //Clean up the input, trim space
    const cleanName = data.categoryName.trim();

    const existingCategory = await prisma.menuCategory.findFirst({
      where:{
        restaurantId,
        name:{
          equals:cleanName,
          mode:"insensitive"
        },
      },
    })
    if(existingCategory){
      categoryId =  existingCategory.id
    }
    else{
      //Create a new Category
      const newCategory = await prisma.menuCategory.create({
        data:{
          name:cleanName,
          restaurantId,
        },
      })
      categoryId = newCategory.id
    }
  }

  if(!categoryId){
    throw new Error("Category is required")
  }

  return await prisma.menuItem.create({
    data: {
      name: data.name,
        description: data.description,
        price: data.price,     // Ensure this is a number before passing here
        imageUrl: data.imageUrl,
        available: true,       // Default to available
        restaurantId,
        categoryId,
    },
  });
}


  // Update menu item
  static async updateMenuItem(id: string, data: any) {
    return await prisma.menuItem.update({
      where: { id },
      data,
    });
  }

  // Delete menu item
  static async deleteMenuItem(id: string) {
    return await prisma.menuItem.delete({
      where: { id },
    });
  }

  // Toggle menu item availability
  static async toggleMenuItemAvailability(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new Error("Menu item not found");

    return await prisma.menuItem.update({
      where: { id },
      data: { available: !item.available },
    });
  }
}
