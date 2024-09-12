const url = require('url');
const cache = require('../lib');
const logger = require('../lib/util').getLogger();

async function handle(req,res,options) {
    const parsedUrl = url.parse(req.url,true);
    const queryObject = parsedUrl.query;
    const artifact = queryObject.artifact;

    if (parsedUrl.pathname.includes("/urn:uuid")) {
        return handleEvent(req,res,options);
    }

    res.setHeader('Content-Type','application/ls+json');
    res.setHeader('Access-Control-Allow-Origin','*');

    if (! artifact) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `need artifact parameter`}));
        return;
    }
   
    const events = await resolveEventLog(artifact);

    if (! events) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `no events for ${artifact}`}));
        return;
    }

    const traceLog = {
        "@context" : "https://labs.eventnotifications.net/contexts/eventlog.jsonld",
        "id": `${process.env.EVENTLOG_BASEURL}${req.url}`, 
        "type": "TraceLog",
        "artifact": artifact,
        "member": []
    };

    for (let i = 0 ; i < events.length ; i++) {
        traceLog.member.push({
            id: `${process.env.EVENTLOG_BASEURL}${parsedUrl.pathname}/${events[i].id}`
        });
    }

    res.writeHead(200);
    res.end(JSON.stringify(traceLog));
}

async function handleEvent(req,res,options) {
    const parsedUrl = url.parse(req.url,true);
    const id = parsedUrl.pathname.replace(/\/trace\//,'');

    const event = await resolveEvent(id);
    
    res.setHeader('Content-Type','application/ls+json');
    res.setHeader('Access-Control-Allow-Origin','*');

    if (! event) {
        res.writeHead(404);
        res.end(JSON.stringify({ error : `need such event ${id}`}));
        return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(event));
}

async function resolveEvent(id) {
    logger.debug(`resolveEvent(${id})`);
    try {
        const event = await cache.getCache(id);
        return event;
    }
    catch (e) {
        logger.error(e);
        return null; 
    }
}

async function resolveEventLog(url) {
    logger.debug(`resolveEventLog(${url})`);

    try {
        let latest;

        // Add here a hack to find the latest trace based on a metadata offer
        if (url === 'latest') {
            const events = await cache.listCache('','original=NULL');
        
            if (events.length == 0) {
                return null;
            }

            latest = events.at(-1);
        }
        else {
            const events = await cache.listCache(`object.id=${url}`);

            if (events.length == 0) {
                return null;
            }

            latest = events.at(-1);
        }

        if (! latest) {
            return null;
        }

        const related = await cache.listCache('',`original=${latest}`);

        const trace = [ latest ].concat(related);

        const resolved = [];

        for (let i = 0 ; i < trace.length ; i++) {
            const event = await cache.getCache(trace[i]); 
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