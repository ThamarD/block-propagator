# Block Propagator

## Introduction

This repository contains the Block Propagator plugin. It controls the propagation of forged blocks to obfuscate the source IP address of the block generator. This makes it harder for any attacker to work out the true IP address of a forging delegate as their blocks will be received from seemingly random IP addresses.

The plugin permits users to specify either a percentage of connected peers to broadcast their blocks to, or a fixed number of peers. The blocks can also be optionally sent directly to seed nodes and specifically whitelisted nodes to aid propagation.

The plugin only controls the propagation of blocks originating from the local forger and does not affect the propagation of blocks sent to the node from other peers.

## Installation

Execute the following:

```yarn global add @alessiodf/block-propagator```

Once the plugin is installed, we must configure it by modifying `plugins.js`. This file is found in `~/.config/ark-core/{mainnet|devnet|testnet|unitnet}/plugins.js` depending on network.

Add a new section to the `module.exports` block for the configuration options. **Add it to the `module.exports` block, after the @arkecosystem/core-p2p section.** An example configuration is below:

```
    "@arkecosystem/core-p2p": {
        port: process.env.CORE_P2P_PORT || 4001,
    },
    "@alessiodf/block-propagator": {
        enabled: true,
        seeds: true,
        peers: 0.10,
        verbose: false,
        whitelist: []
    },

```

## Running

After installation, make sure the `plugins.js` file is correctly configured and restart Ark Core with `ark core:restart` (or `ark relay:restart` and `ark forger:restart` if you wish to use the separate processes rather than the unified Core). The plugin will start whenever the Core or Relay process is running, as long as the `enabled` configuration option is `true`.

## Configuration Options

- `enabled` - Should be `true` to enable the plugin or `false` to disable it. Default: `false`.

- `seeds` - A boolean value to denote whether to broadcast our blocks directly to the seed peers in addition to any whitelisted peers and randomly chosen peers. Default: `false`.

- `peers` - This is a numerical value. If a decimal between 0 and 1 is entered, it is used to determine the percentage of connected peers to broadcast our blocks to. For example, `0.20` will broadcast our blocks to 20% of our connected peers. If it is a number larger than 1, it will broadcast to exactly that number of peers. For example, `20` will broadcast to exactly 20 peers. Note this is in addition to any seed peers or whitelisted peers that may have been specified. Default: `0.20`.

- `verbose` - A boolean value to specify whether to print the list of chosen peers we are broadcasting the current block to. Default: `false`.

- `whitelist` - This is an array of objects containing `ip` and `port` attributes. Any peers specified in the whitelist will always receive our blocks directly. For example, `[{ "ip": "1.2.3.4", "port": 4001}, { "ip": "5.6.7.8", "port": 4001}]` will result in peers at IP addresses 1.2.3.4 and 5.6.7.8 on port 4001 always receiving our blocks in addition to any seed peers and randomly chosen peers. Default `[]` (empty array).

## Updating

It is important to keep this plugin up to date with the latest Core changes that may affect the way blocks are sent and received on the network. To update the plugin, run:

```yarn global upgrade @alessiodf/block-propagator```

Remember to restart Core after the plugin has been updated.

## Credits

-   [All Contributors](../../contributors)
-   [alessiodf](https://github.com/alessiodf)
-   [eugeneli](https://github.com/eugeneli)

## License

[GPLv3](LICENSE) © [alessiodf](https://github.com/alessiodf)