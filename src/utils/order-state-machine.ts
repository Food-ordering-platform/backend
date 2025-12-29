import { OrderStatus } from "../../generated/prisma";

/**
 * Deterministic Finite Automata (DFA) for Order Lifecycle
 * Defines strictly allowed transitions between states.
 */

export class OrderStateMachine {
  // Definition of the transition function δ: Q x Σ -> Q
  private static transitions: Record<OrderStatus, OrderStatus[]> = {
    //Initial State
    PENDING: ["PREPARING", "CANCELLED"],

    //Kitchen is working
    PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],

    //Rider has picked up
    OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],

    // Terminal States (Accepting States)
    DELIVERED: [],
    CANCELLED: [],
  };
  /**
       * Validates if a transition from 'current' to 'next' is valid in the DFA.
       * @param current The current state of the order
       * @param next The desired next state
       * @throws Error if the transition is invalid
       * 

*/

    static validateTransition(current: OrderStatus,  next: OrderStatus) : void {
        const allowed = this.transitions[current]

        if(current === next) return

        if(!allowed || !allowed.includes(next)){
            throw new Error(`Invalid State Transition: Cannot move order from  ${current} to ${next}. Allowed transitions: [${allowed?.join(", ") || "None"}]`)
        }
    }

    /**
   * Checks if a state is terminal (no outgoing edges)
   */
  static isTerminal(status: OrderStatus): boolean {
    return this.transitions[status].length === 0;
  }
}
