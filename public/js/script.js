function actorName(actor) {
    const id = actor?.id;

    if (! id) {
        return 'Claimbot';
    }
    else if (id === 'https://mycontributions.info/service/m/profile/card#me') {
        return 'Claimbot';
    }
    else if (id === 'https://mycontributions.info/service/x/profile/card#me') {
        return 'MetadataService';
    }
    else if (id === 'https://wiki.mycontributions.info/profile/card#me') {
        return 'WikiService'
    }
    else {
        return 'Mastodon ' + id.replace(/.*@/g,'@');
    }
}

function traceAdd(trace,time,actor,target,type,content) {
    trace += `T0+${time} <b>${actor}</b> => <b>${target}</b> : <b style="color: green">${type}</b> "${content}"\n`;
    return trace;
}

$( document ).ready( async function() {
    const json = await $.getJSON( "trace?artifact=latest");
    const events = [];

    if (json.member) {
        for (let i = 0 ; i < json.member.length ; i++) {
            const evtUrl = json.member[i].id;
            const evt = await $.getJSON(evtUrl);
            events.push(evt);
        }
    }

    let story = `
sequenceDiagram
   autonumber
`;
   
    let trace = '';

    let startTime;

    for (let i = 0 ; i < events.length ; i++) {
        const evt = events[i];
        const date = new Date(evt.published);
        const actor = actorName(evt.actor);
        const target = actorName(evt.target);
        let timeDiff = 0;
        let message = '';

        if (!startTime) {
            startTime = date;
            timeDiff = 0;
        }
        else {
            timeDiff = Math.floor((startTime - date) / 1000) % 60;
        }

        let messageType = 'request';

        if (evt.type === 'Announce' && actor.startsWith('Mastodon')) {
            if (evt.object.url) {
                message = evt.object.url[0].href;
                messageType = 'request';
                trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.url[0].href);
            }
        }
        else if (evt.type === 'Offer' && actor === 'Claimbot') {
            message = evt.object.id;
            messageType = 'request';
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        } 
        else if (evt.type === 'Announce' && actor === 'MetadataService') {
            message = 'Service Result of metadata lookup'
            messageType = 'response';
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
        else if (evt.type === 'Reject' && actor === 'MetadataService') {
            message = evt.object.object.id;
            messageType = 'response';
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.object.id);
        }
        else if (evt.type === 'Announce' && actor === 'WikiService') {
            message = evt.object.id.replace(/^.*orcid/,'http://wiki.../orcid');
            messageType = 'response';
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
        else if (evt.type === 'Announce' && actor === 'Claimbot') {
            message = evt.object.content.substring(0,40);
            messageType = 'response';
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.content);
        }

        if (message.length > 40) {
            message = 
                message.substring(0,20) + 
                '...' + 
                message.substring(message.length - 20);
        }

        story += `   ${actor}` + 
                 (messageType === 'request' ? '->>+' : '-->>-') + 
                 `${target}: ${message}\n`;
        story += `   Note right of ${actor}: ${evt.type}\n`;
    }

    console.log(trace);

    const g_element = document.querySelector('#graphDiv');
    const { svg, bindFunctions } = await mermaid.render('pre', story);
    g_element.innerHTML = svg;

    if (bindFunctions) {
        bindFunctions(g_element);
    }

    const t_element = document.querySelector('#graphTrace');
    t_element.innerHTML = trace;
});