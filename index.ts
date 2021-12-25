import {Vec3} from "vec3";
import {BehaviorIdle, StateBehavior, StateMachineTargets} from "mineflayer-statemachine";
import * as mineflayer from "mineflayer";
import {mineflayerViewer} from 'prismarine-viewer'
const credentials = require("./credentials.json") // Import credentials externally. In the future, check args for credentials
import {
    StateTransition,
    BotStateMachine,
    BehaviorMoveTo,
    NestedStateMachine } from "mineflayer-statemachine";
import {Movements, pathfinder} from 'mineflayer-pathfinder';
import {Bot} from "mineflayer";
const mineflayerViewer = require('prismarine-viewer').mineflayer;

/// <reference path="./node_modules/mineflayer/index.d.ts">

// Run the bot.
let bot = mineflayer.createBot({
    username: credentials.username,
    password: credentials.password,
    host: credentials.host
});

bot.loadPlugin(pathfinder);

interface CustomTargets extends StateMachineTargets{
    index: number
    numSegments: number,
}

class SelectNextDestination implements StateBehavior {
    active: boolean = false;
    stateName: string = 'SelectNextDestination';

    private readonly bot: Bot;
    private targets: CustomTargets;

    constructor(bot: Bot, targets: CustomTargets) {
        this.bot = bot;
        this.targets = targets;
    }

    onStateEntered(): void {
        if(this.targets.index === undefined || this.targets.positions === undefined){
            console.log(`[${this.stateName}] Index or positions are not defined`);
            return;
        }

        this.targets.index++;
        if(this.targets.index >= this.targets.numSegments)
            this.targets.index = 0;
        this.targets.position = this.targets.positions[this.targets.index];

        console.log(`[${this.stateName}] Moving to position ${this.targets.index}: ${this.targets.position}`);
    }
}

bot.once("spawn", () => {
    console.log("Connected.");

    // viewer takes up shit ton of resources
    mineflayerViewer(bot, {port: 3000});

    const mcData = require('minecraft-data')(bot.version)

    const defaultMove = new Movements(bot, mcData)


    // Empty target list... for now
    const segments = 10, radius = 10;

    const targets: CustomTargets = {
        index: 0,
        numSegments: segments,
        positions: [],
    };

    let position = bot.entity.position;

    const angle = 2*Math.PI / segments;

    for(let i = 0; i < segments; i++){
        let currentAngle = angle * i;
        const z_offset = Math.sin(currentAngle) * radius;
        console.log(z_offset);
        const x_offset = Math.cos(currentAngle) * radius;
        console.log(x_offset);
        const destination = new Vec3(position.x + x_offset, 320, position.z + z_offset);
        targets.positions.push(destination);
    }

    const enter = new BehaviorIdle();

    const moveState = new BehaviorMoveTo(bot, targets);
    const destinationSelect = new SelectNextDestination(bot, targets);

    const transitions = [
        new StateTransition({
            parent: enter,
            child: destinationSelect,
            shouldTransition: () => true
        }),
        new StateTransition({
            parent: destinationSelect,
            child: moveState,
            shouldTransition: () => true,
            onTransition: () => {moveState.restart();}
        }),
        new StateTransition({
            parent: moveState,
            child: destinationSelect,
            shouldTransition: () => {return moveState.isFinished()}
        })
    ];

    const rootLayer = new NestedStateMachine(transitions, enter);
    new BotStateMachine(bot, rootLayer);
});