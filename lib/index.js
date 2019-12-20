"use strict";

exports.plugin = {
    pkg: require("../package.json"),
    defaults: {
        enabled: false,
        seeds: false,
        peers: 0.20,
        verbose: false,
        whitelist: []
    },

    async register(app, options) {
        if (!options.enabled || isNaN(options.peers) || options.peers < 0 || !Array.isArray(options.whitelist) || (options.peers < 0.01 && !options.seeds && options.whitelist.length === 0)) {
            return;
        }

        const scopes = Object.keys(app.plugins.plugins).filter(
              scope => scope.endsWith("/core-api") ||
              scope.endsWith("/core-blockchain") ||
              scope.endsWith("/core-event-emitter") ||
              scope.endsWith("/core-p2p") ||
              scope.endsWith("/core-state") ||
              scope.endsWith("/core-transaction-pool")
        ).map(
              scope => scope.substring(0, scope.lastIndexOf("/"))
        ).reduce((count, current) => {
              if (current in count) {
                  count[current]++;
              } else {
                  count[current] = 1;
              }
              return count;
        },{});

        const scope = Object.keys(scopes).reduce((a, b) => scopes[a] > scopes[b] ? a : b);

        const { Blocks } = require(`${scope}/crypto`);

        const logger = app.resolvePlugin("logger");
        const p2p = app.resolvePlugin("p2p");
        const p2pOptions = app.resolveOptions("p2p");

        const path = require("path");
        const pluralize = require("pluralize");
        const shuffle = require("lodash/shuffle");
        const take = require("lodash/take");

        const getPath = dir => path.join(path.dirname(process.mainModule.filename), dir);

        const { getHeaders } = require(getPath("/../../core-p2p/dist/socket-server/utils/get-headers"));
        const { Peer } = require(getPath("/../../core-p2p/dist/peer"));
        const { isWhitelisted } = require(getPath("/../../core-p2p/dist/utils/is-whitelisted"));

        const seeds = options.seeds ? app.getConfig().get("peers.list").map(peer => new Peer(peer.ip, peer.port)) : [];
        const whitelist = options.whitelist ? options.whitelist.map(peer => new Peer(peer.ip, peer.port)) : [];

        let lastPropagatedBlock;

        const propagateBlock = block => {
            if (!block) {
                return;
            }
            const blockId = block.id || block.data.id;
            if (!blockId || lastPropagatedBlock === blockId) {
                return;
            }
            const height = block.height || block.data.height;
            const peerFilter = seeds.map(peer => peer.ip).concat(whitelist.map(peer => peer.ip));
            const peersStorage = p2p.storage.getPeers();
            const peersFiltered = peersStorage.filter(peer => !peerFilter.includes(peer.ip));
            const peersCount = options.peers <= 1 ? peersFiltered.length * options.peers : options.peers;
            const peers = whitelist.concat(seeds).concat(take(shuffle(peersFiltered), peersCount));
            if (options.verbose) {
                logger.debug(`Broadcasting block ${height.toLocaleString()} to selected peers: ${JSON.stringify(peers.map(peer => peer.ip))}`);
            }
            logger.info(`Broadcasting block ${height.toLocaleString()} to ${pluralize("peer", peers.length, true)}`);
            peers.map(peer => p2p.communicator.postBlock(peer, block));
            lastPropagatedBlock = blockId;
        };

        const listener = p2p.monitor.server.listeners("workerMessage")[0];
        p2p.monitor.server.removeListener("workerMessage", listener);
        p2p.monitor.server.on("workerMessage", async (workerId, req, res) => {
            if (req.endpoint === "p2p.peer.postBlock") {
                const fromForger = isWhitelisted(p2pOptions.remoteAccess, req.headers.remoteAddress);
                if (fromForger) {
                    const block = req.data.block.data && Array.isArray(req.data.block.data) ? Blocks.BlockFactory.fromHex(Buffer.from(req.data.block.data).toString("hex")) : req.data.block;
                    propagateBlock(block);
                    return res(undefined, {
                        data: {},
                        headers: getHeaders(),
                    });
                }
            }
            return await listener(workerId, req, res);
        });
    }
}

