const credentials = require("./credentials.json") // Import credentials externally. In the future, check args for credentials
const mineflayer = require('mineflayer');
const {
    StateTransition,
    BotStateMachine,
    EntityFilters,
    BehaviorFollowEntity,
    BehaviorLookAtEntity,
    BehaviorGetClosestEntity,
    NestedStateMachine } = require("mineflayer-statemachine");
const Pathfinder = require("mineflayer-pathfinder");

// Run the bot.
// atm connects to localhost due to default parameters
let bot = mineflayer.createBot({
    username: credentials.username,
    password: credentials.password
});

bot.once("spawn", () => {
    console.log("connected");
})