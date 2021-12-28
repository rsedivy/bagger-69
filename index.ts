import {Vec3} from "vec3";
import {pathfinder} from 'mineflayer-pathfinder';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer'
import * as mcDataLoader from 'minecraft-data'
import {
    BehaviorFindInteractPosition,
    BehaviorIdle, BehaviorMineBlock,
    StateBehavior,
    StateMachineTargets,
    globalSettings
} from "mineflayer-statemachine";
import * as mineflayer from "mineflayer";
import {
    StateTransition,
    BotStateMachine,
    BehaviorMoveTo,
    NestedStateMachine
} from "mineflayer-statemachine";


const credentials = require("./credentials.json") // Import credentials externally. In the future, check args for credentials

// const mcData = mcDataLoader("1.7.1");

globalSettings.debugMode = true; // Enable debug mode.

const START = new Vec3(25.5, 61, -62.5).floor().offset(0.5,0,0.5);
const SIZE = new Vec3(10, 30, 10);

/// <reference path="./node_modules/mineflayer/index.d.ts">

// Run the bot.
let bot = mineflayer.createBot({
    username: credentials.username,
    password: credentials.password,
    host: credentials.host,
    hideErrors: false // for debug purposes
});

bot.loadPlugin(pathfinder);

interface CustomTargets extends StateMachineTargets{
    chestLocation: Vec3,
    craftingTable: Vec3,
    digOrder: Vec3[],
    torchPosition?: Vec3[]
}

class SelectBlock implements StateBehavior {
    active: boolean = false;
    stateName: string = 'SelectBlock';
    readonly bot: mineflayer.Bot;
    readonly targets: CustomTargets;

    constructor(bot: mineflayer.Bot, targets: CustomTargets)
    {
        this.bot = bot;
        this.targets = targets;
    }

    onStateEntered(): void
    {
        if((this.targets?.digOrder.length > 0)){
            console.log(`[${this.stateName}] Entered`);

            const position = this.targets.digOrder[0];
            /*console.log(`[${this.stateName}] Checking block ${bot.entity.position.offset(0,-1,0)}`);

            let block = bot.blockAt(bot.entity.position.offset(0,-1,0));
            console.log(JSON.stringify(block, null, '\t'));*/

            if(bot.blockAt(position)?.type === 0 ||
                bot.blockAt(position)?.type === 50 ){
                this.targets.digOrder.shift();
                console.log(`[${this.stateName}] Block at ${position} is air or torch`);

                this.onStateEntered();
            }else{
                this.targets.position = position;
                return;
            }
        }
    }
}

class MineSelect implements StateBehavior {
    active: boolean = false;
    stateName: string = 'MineSelect';
    readonly bot: mineflayer.Bot;
    readonly targets: CustomTargets;

    constructor(bot: mineflayer.Bot, targets: CustomTargets)
    {
        this.bot = bot;
        this.targets = targets;
    }

    onStateEntered(): void
    {
        console.log(`[${this.stateName}] Entered`);
        if((this.targets?.digOrder.length > 0)){
            this.targets.position = this.targets.digOrder.shift();
            console.log(`[${this.stateName}] Mining at position ${this.targets.position}`);
        }
    }
}


bot.once("spawn", () => {
    console.log("Connected.");

    // viewer takes up a lot of resources, but is great for tracking progress
    mineflayerViewer(bot, {port: 3000});

    bot.waitForChunksToLoad()
        .then(() => {
            console.log("Chunks loaded");
            runStateMachine()
        });

});

function runStateMachine() : void {

    const digOrder = generateDigOrder();

    // targets list
    const targets: CustomTargets = {
        chestLocation: new Vec3(0,0,0),
        craftingTable: new Vec3(0,0,0),
        digOrder: digOrder
    };


    const enter = new BehaviorIdle(); // entry state
    const exit = new BehaviorIdle(); // exit state

    const selectBlock = new SelectBlock(bot, targets);
    const findInteractPos = new BehaviorFindInteractPosition(bot, targets);
    const moveTo = new BehaviorMoveTo(bot, targets);
    const mineSelect = new MineSelect(bot, targets);
    const mineBlock = new BehaviorMineBlock(bot, targets);

    const transitions = [
        new StateTransition({
            parent: enter,
            child: selectBlock,
            shouldTransition: () => true
        }),
        new StateTransition({
            parent: selectBlock,
            child: findInteractPos,
            shouldTransition: () => true,

        }),
        new StateTransition({
            parent: findInteractPos,
            child: moveTo,
            shouldTransition: () => true,

        }),
        new StateTransition({
            parent: moveTo,
            child: mineSelect,
            shouldTransition: () => {
                return moveTo.isFinished();
            },

        }),
        new StateTransition({
            parent: mineSelect,
            child: mineBlock,
            shouldTransition: () => true,

        }),
        new StateTransition({
            parent: mineBlock,
            child: selectBlock,
            shouldTransition: () => {
                return mineBlock.isFinished && targets.digOrder.length > 0;
            },
        }),
        new StateTransition({
            parent: mineBlock,
            child: exit,
            shouldTransition: () => {
                return mineBlock.isFinished;
            }
        })
    ]

    console.log("Starting State machine");

    const rootLayer = new NestedStateMachine(transitions, enter);
    new BotStateMachine(bot, rootLayer);
}

function generateDigOrder() : Vec3[]{


    const order: Array<Vec3> = [];

    for (let i = 0; i < SIZE.y; i++) {

        // Add stairs to the side. Every x blocks in depth,
        // reverse the stairs.
        // This staircase will be on the x+ side
        const frontStairX = SIZE.x;
        const backStairX = SIZE.x + 1;
        // Lateral position of stairs

        if(!(~~(i / SIZE.z) % 2)){
            const stairZ = ~~(i % SIZE.z)

            // digging towards the front
            order.push(new Vec3(frontStairX, -i, stairZ).plus(START))

            if(stairZ === 0){
                order.push(new Vec3(frontStairX, -(i-1), stairZ +1).plus(START));
            }

            if(stairZ === SIZE.z - 1){
                // if it's the last stair before switching directions
                // dig three vertically to the side
                order.push(new Vec3(backStairX, -i, stairZ).plus(START));
                order.push(new Vec3(backStairX, -(i - 1), stairZ).plus(START));
                order.push(new Vec3(backStairX, -(i - 2), stairZ).plus(START));
            }else if(stairZ === SIZE.z - 2){
                // On the second to last stair, just dig one block in front.
                order.push(new Vec3(frontStairX, -i, stairZ + 1).plus(START))
            }else{
                // dig two blocks in front
                order.push(new Vec3(frontStairX, -i, stairZ + 1).plus(START))
                order.push(new Vec3(frontStairX, -i, stairZ + 2).plus(START))
            }
        }else{
            const stairZ = SIZE.z - (~~(i % SIZE.z)) - 1;

            order.push(new Vec3(backStairX, -i, stairZ).plus(START));

            if(stairZ === 0){
                order.push(new Vec3(frontStairX, -i, stairZ).plus(START));
                order.push(new Vec3(frontStairX, -(i-1), stairZ).plus(START));
            }else if(stairZ === 1){
                order.push(new Vec3(backStairX, -i, stairZ-1).plus(START));
                order.push(new Vec3(frontStairX, -i, stairZ).plus(START));
                order.push(new Vec3(frontStairX, -i, stairZ-1).plus(START));
            }else if(stairZ === SIZE.z -1){
                order.push(new Vec3(backStairX, -(i -1), stairZ-1).plus(START));
                order.push(new Vec3(backStairX, -(i -1), stairZ-2).plus(START));
                order.push(new Vec3(backStairX, -i, stairZ-1).plus(START));
                order.push(new Vec3(backStairX, -i, stairZ-2).plus(START));

                order.push(new Vec3(frontStairX, -(i -1), stairZ-2).plus(START));
                order.push(new Vec3(frontStairX, -i, stairZ-2).plus(START));
            }else{
                order.push(new Vec3(backStairX, -i, stairZ-1).plus(START));
                order.push(new Vec3(backStairX, -i, stairZ-2).plus(START));

                order.push(new Vec3(frontStairX, -i, stairZ).plus(START));
                order.push(new Vec3(frontStairX, -i, stairZ-1).plus(START));
                order.push(new Vec3(frontStairX, -i, stairZ-2).plus(START));
            }

        }

        /*
            Dig blocks in scanline order
         */

        for (let j = 0; j < SIZE.x; j++) {
            if (j % 2) {
                for (let k = 0; k < SIZE.z; k++) {
                    order.push(new Vec3(j, -i, k).plus(START));
                }
            } else {
                for (let k = SIZE.z - 1; k >= 0; k--) {
                    order.push(new Vec3(j, -i, k).plus(START));
                }
            }
        }


    }

    return order;
}
