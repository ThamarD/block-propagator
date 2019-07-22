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
            if (!block || !block.id || lastPropagatedBlock === block.id) {
                return;
            }
            const peerFilter = seeds.map(peer => peer.ip).concat(whitelist.map(peer => peer.ip));
            const peersStorage = p2p.storage.getPeers();
            const peersFiltered = peersStorage.filter(peer => !peerFilter.includes(peer.ip));
            const peersCount = options.peers <= 1 ? peersFiltered.length * options.peers : options.peers;
            const peers = whitelist.concat(seeds).concat(take(shuffle(peersFiltered), peersCount));
            if (options.verbose) {
                logger.debug(`Broadcasting block ${block.height.toLocaleString()} to selected peers: ${JSON.stringify(peers.map(peer => peer.ip))}`);
            }
            logger.info(`Broadcasting block ${block.height.toLocaleString()} to ${pluralize("peer", peers.length, true)}`);
            peers.map(peer => p2p.communicator.postBlock(peer, block));
            lastPropagatedBlock = block.id;
        };

        const listener = p2p.monitor.server.listeners("workerMessage")[0];
        p2p.monitor.server.removeListener("workerMessage", listener);
        p2p.monitor.server.on("workerMessage", async (workerId, req, res) => {
            if (req.endpoint === "p2p.peer.postBlock") {
                const fromForger = isWhitelisted(p2pOptions.remoteAccess, req.headers.remoteAddress);
                if (fromForger) {
                    const block = req.data.block;
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
