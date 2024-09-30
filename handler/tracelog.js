const url = require('url');
const cache = require('../lib');
const logger = require('../lib/util').getLogger();
const md5 = require('md5');

async function handle(req,res,options) {
    const parsedUrl = url.parse(req.url,true);
    const queryObject = parsedUrl.query;
    const artifact = queryObject.artifact;
    const cacheName = queryObject.cache || 'cache';

    if (parsedUrl.pathname.includes("/urn:uuid")) {
        return handleEvent(req,res,options,{ name: cacheName });
    }

    res.setHeader('Content-Type','application/ld+json');
    res.setHeader('Access-Control-Allow-Origin','*');

    if (! artifact) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `need artifact parameter`}));
        return;
    }
   
    const events = await resolveEventLog(artifact, { name: cacheName });

    if (! events) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `no events for ${artifact}`}));
        return;
    }

    const traceLog = {
        "@context" : "https://labs.eventnotifications.net/contexts/eventlog.jsonld",
        "id": `${process.env.EVENTLOG_BASEURL}${req.url}`, 
        "type": "EventLog",
        "artifact": artifact,
        "member": []
    };

    for (let i = 0 ; i < events.length ; i++) {
        const event = events[i];
        const context = await cache.getCacheContext(event.id, { name: cacheName });
        const checksum = md5(makeEvent(event));
        traceLog.member.push({
            id: `${process.env.EVENTLOG_BASEURL}${parsedUrl.pathname}/${event.id}` ,
            created: context.updated,
            checksum: {
                type: "Checksum",
                algorithm: "spdx:checksumAlgorithm_md5",
                checksumValue: checksum
            }
        });
    }

    res.writeHead(200);
    res.end(JSON.stringify(traceLog));
}

async function handleEvent(req,res,options,param) {
    const parsedUrl = url.parse(req.url,true);
    const id = parsedUrl.pathname.replace(/\/trace\//,'');

    const event = await resolveEvent(id,param);
    
    res.setHeader('Content-Type','application/ls+json');
    res.setHeader('Access-Control-Allow-Origin','*');

    if (! event) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `need such event ${id}`}));
        return;
    }

    res.writeHead(200);
    res.end(makeEvent(event));
}

function makeEvent(event) {
    return JSON.stringify(event);
}

async function resolveEvent(id,param) {
    logger.debug(`resolveEvent(${id},${param})`);
    try {
        const event = await cache.getCache(id,param);
        return event;
    }
    catch (e) {
        logger.error(e);
        return null; 
    }
}

async function resolveEventLog(url,param) {
    logger.debug(`resolveEventLog(${url},${param})`);

    try {
        let latest;

        // Add here a hack to find the latest trace based on a metadata offer
        if (url === 'latest') {
            const events = await cache.listCache('','original=NULL',param);
        
            if (events.length == 0) {
                return null;
            }

            latest = events.at(-1);
        }
        else {
            const events = await cache.listCache(`object.id=${url}`,param);

            if (events.length == 0) {
                return null;
            }

            latest = events.at(-1);
        }

        if (! latest) {
            return null;
        }

        const related = await cache.listCache('',`original=${latest}`,param);

        const trace = [ latest ].concat(related);

        const resolved = [];

        for (let i = 0 ; i < trace.length ; i++) {
            const event = await cache.getCache(trace[i],param); 
            resolved.push(event);      
        }

        return resolved;
    }
    catch (e) {
        logger.error(e);
        return null;
    }
}

module.exports = { handle };