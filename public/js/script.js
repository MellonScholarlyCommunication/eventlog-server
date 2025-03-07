function actorName(actor) {
    const id = actor?.id;
    const name = actor?.name;

    if (! id) {
        return 'Claimbot';
    }
    else if (id === 'https://mycontributions.info/service/m/profile/card#me') {
        return 'Claimbot';
    }
    else if (name.startsWith('Claim') || name === 'Mastodon Bot') {
        return 'Claimbot';
    }
    else if (id === 'https://mycontributions.info/service/x/profile/card#me') {
        return 'MetadataService';
    }
    else if (name.startsWith('Metadata')) {
        return 'MetadataService';
    }
    else if (id === 'https://wiki.mycontributions.info/profile/card#me') {
        return 'WikiService';
    }
    else if (name.startsWith('Wiki')) {
        return 'WikiService';
    }
    else {
        return 'Mastodon ' + id.replace(/.*@/g,'@');
    }
}

function storyAdd(story,actor,target,notificationType,messageType,message) {
    if (message.length > 40) {
        message = 
            message.substring(0,20) + 
            '...' + 
            message.substring(message.length - 20);
    }

    story += `   ${actor}` + 
             (messageType === 'request' ? '->>+' : '->>+') + 
             `${target}: ${message}\n`;
    story += `   Note right of ${actor}: ${notificationType}\n`;

    return story;
}

function traceAdd(trace,time,actor,target,type,content) {
    let html_content;
    if (content.startsWith("http")) {
        html_content = `<a href="${content}">${content}</a>`;
    }
    else {
        html_content = content;
    }
    trace += `
        <div class="tline">
            <span class="ttime">T0+${time}</span> 
            <span class="ttype">${type}</span> : 
            <span class="tactor">${actor}</span> 
            => 
            <span class="ttarget">${target}</span> 
            <br>
            <span class="tcontent">${html_content}</span>
        </div>\n`;
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

        console.log(`${evt.type} from ${actor} to ${target}`);

        if (!startTime) {
            startTime = date;
            timeDiff = 0;
        }
        else {
            timeDiff = Math.floor((date - startTime) / 1000) % 60;
        }

        let messageType = 'request';

        if (evt.type === 'Announce' && actor.startsWith('Mastodon')) {
            if (evt.object.url) {
                story = storyAdd(story,actor,target,evt.type,'request',evt.object.url[0].href);
                trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.url[0].href);
            }
        }
        else if (evt.type === 'View' && actor === 'Claimbot' && target.startsWith('Mastodon')) {
            story = storyAdd(story,actor,target,evt.type,'request',evt.object.id);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id); 
        }
        else if (evt.type === 'Offer' && actor === 'Claimbot' && target === 'MetadataService') {
            story = storyAdd(story,actor,target,evt.type,'request',evt.object.id);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        } 
        else if (evt.type === 'Offer' && actor === 'Claimbot' && target === 'WikiService') {
            story = storyAdd(story,actor,target,evt.type,'request',evt.object.id);
            const citation = evt.object.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,citation);
        }
        else if (evt.type === 'View' && actor === 'Claimbot' && target === 'WikiService') {
            story = storyAdd(story,actor,target,evt.type,'request',evt.object.id);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
        else if (evt.type === 'Announce' && actor === 'MetadataService') {
            story = storyAdd(story,actor,target,evt.type,'response','Service Result of metadata lookup');
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
        else if (evt.type === 'Reject' && actor === 'MetadataService') {
            story = storyAdd(story,actor,target,evt.type,'response',evt.object.object.id);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.object.id);
        }
        else if (evt.type === 'Announce' && actor === 'WikiService') {
            story = storyAdd(story,actor,target,evt.type,'response',evt.object.id.replace(/^.*orcid/,'http://wiki.../orcid'));
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
        else if (evt.type === 'Announce' && actor === 'Claimbot') {
            story = storyAdd(story,actor,target,evt.type,'response',evt.object.content);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.content);
        }
    }

    const g_element = document.querySelector('#graphDiv');
    const { svg, bindFunctions } = await mermaid.render('pre', story);
    g_element.innerHTML = svg;

    if (bindFunctions) {
        bindFunctions(g_element);
    }

    const t_element = document.querySelector('#graphTrace');
    t_element.innerHTML = trace;
});