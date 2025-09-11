import { Request, Response } from "express";
import { RestaurantService } from "./restaurant.service";
import { success } from "zod";

export class RestaurantController{
    //Get /Restaurant
    static async getAllRestaurants(req:Request, res:Response){
        try{
            const restaurant = await RestaurantService.getAllRestaurant();
            res.status(200).json({
                success:true,
                data:restaurant
            });
        }
        catch(err: any){
            console.error("Error fetching Restaurants", err)
            res.status(500).json({
                success:false,
                message:"Failed to fetch restaurants"
            })
        }
    }

    //Get /restaurant/id
    static async getRestaurantById(req:Request,  res:Response){
        try{
            const {id} = req.params
            const restaurant = await RestaurantService.getRestuarantbyId(id)

            if(!restaurant){
                return res.status(401).json({
                    success:false,
                    message:"Resturant not found"
                })
            }
            res.status(200).json({
                success:true,
                data:restaurant
            })
        }
        catch(err: any){
            console.error("Error fetching restaurant:", err);
            return res.status(500).json({
                success:false,
                message:"Failed to fetch Restaurant"
            })
        }
    }
}