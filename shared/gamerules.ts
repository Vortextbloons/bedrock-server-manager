export interface GameruleDef {
  label: string;
  type: 'bool' | 'int';
  commandTemplate: string;
  description?: string;
  defaultValue?: string | boolean | number;
}

export const BEDROCK_GAMERULES: Record<string, GameruleDef> = {
  commandblockoutput: { label: 'Command Block Output', type: 'bool', commandTemplate: 'commandblockoutput %s', description: 'Whether command blocks should notify admins when they perform commands' },
  commandblocksenabled: { label: 'Command Blocks Enabled', type: 'bool', commandTemplate: 'commandblocksenabled %s', description: 'Whether command blocks are enabled' },
  dodaylightcycle: { label: 'Do Daylight Cycle', type: 'bool', commandTemplate: 'dodaylightcycle %s', description: 'Whether the daylight cycle and moon phases progress' },
  doentitydrops: { label: 'Do Entity Drops', type: 'bool', commandTemplate: 'doentitydrops %s', description: 'Whether entities drop loot' },
  dofiretick: { label: 'Do Fire Tick', type: 'bool', commandTemplate: 'dofiretick %s', description: 'Whether fire spreads and naturally extinguishes' },
  doimmediaterespawn: { label: 'Do Immediate Respawn', type: 'bool', commandTemplate: 'doimmediaterespawn %s', description: 'Players respawn immediately without showing the death screen' },
  doinsomnia: { label: 'Do Insomnia', type: 'bool', commandTemplate: 'doinsomnia %s', description: 'Whether phantoms can spawn at night' },
  domobloot: { label: 'Do Mob Loot', type: 'bool', commandTemplate: 'domobloot %s', description: 'Whether mobs drop loot' },
  domobspawning: { label: 'Do Mob Spawning', type: 'bool', commandTemplate: 'domobspawning %s', description: 'Whether mobs spawn naturally' },
  dotiledrops: { label: 'Do Tile Drops', type: 'bool', commandTemplate: 'dotiledrops %s', description: 'Whether blocks drop as items when broken' },
  doweathercycle: { label: 'Do Weather Cycle', type: 'bool', commandTemplate: 'doweathercycle %s', description: 'Whether the weather changes naturally' },
  drowningdamage: { label: 'Drowning Damage', type: 'bool', commandTemplate: 'drowningdamage %s', description: 'Whether players take drowning damage' },
  falldamage: { label: 'Fall Damage', type: 'bool', commandTemplate: 'falldamage %s', description: 'Whether players take fall damage' },
  firedamage: { label: 'Fire Damage', type: 'bool', commandTemplate: 'firedamage %s', description: 'Whether players take fire damage' },
  freezedamage: { label: 'Freeze Damage', type: 'bool', commandTemplate: 'freezedamage %s', description: 'Whether players take damage from powder snow' },
  keepinventory: { label: 'Keep Inventory', type: 'bool', commandTemplate: 'keepinventory %s', description: 'Whether players keep items on death' },
  maxcommandchainlength: { label: 'Max Command Chain Length', type: 'int', commandTemplate: 'maxcommandchainlength %s', description: 'Maximum number of chained command blocks that can execute', defaultValue: 65536 },
  mobgriefing: { label: 'Mob Griefing', type: 'bool', commandTemplate: 'mobgriefing %s', description: 'Whether mobs can change blocks' },
  naturalregeneration: { label: 'Natural Regeneration', type: 'bool', commandTemplate: 'naturalregeneration %s', description: 'Whether players can regenerate health naturally' },
  pvp: { label: 'PVP', type: 'bool', commandTemplate: 'pvp %s', description: 'Whether players can fight each other' },
  randomtickspeed: { label: 'Random Tick Speed', type: 'int', commandTemplate: 'randomtickspeed %s', description: 'How often a random block tick occurs per chunk section per game tick', defaultValue: 1 },
  respawnblocksexplode: { label: 'Respawn Blocks Explode', type: 'bool', commandTemplate: 'respawnblocksexplode %s', description: 'Whether respawn anchors and beds explode in other dimensions' },
  sendcommandfeedback: { label: 'Send Command Feedback', type: 'bool', commandTemplate: 'sendcommandfeedback %s', description: 'Whether chat feedback from commands appears' },
  showbordereffect: { label: 'Show Border Effect', type: 'bool', commandTemplate: 'showbordereffect %s', description: 'Whether world border particles appear' },
  showcoordinates: { label: 'Show Coordinates', type: 'bool', commandTemplate: 'showcoordinates %s', description: 'Whether player coordinates are displayed' },
  showdeathmessages: { label: 'Show Death Messages', type: 'bool', commandTemplate: 'showdeathmessages %s', description: 'Whether death messages appear in chat' },
  showtags: { label: 'Show Tags', type: 'bool', commandTemplate: 'showtags %s', description: 'Whether entity tags are visible' },
  spawnradius: { label: 'Spawn Radius', type: 'int', commandTemplate: 'spawnradius %s', description: 'Radius around the world spawn point players spawn in', defaultValue: 5 },
  tntexplodes: { label: 'TNT Explodes', type: 'bool', commandTemplate: 'tntexplodes %s', description: 'Whether TNT explosions are enabled' },
};

export interface GameruleValue {
  rule: string;
  currentValue: string;
  type: 'bool' | 'int';
  label: string;
  description?: string;
  defaultValue?: string | boolean | number;
}

export interface GamerulesResponse {
  gamerules: GameruleValue[];
  isOnline: boolean;
}

export interface ServerActionRequest {
  action: 'tp' | 'give' | 'kill';
  target: string;
  destination?: string;
  x?: number;
  y?: number;
  z?: number;
  item?: string;
  amount?: number;
  data?: number;
}
