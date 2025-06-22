const ACTOR_TYPES = {
    'http://host.docker.internal:3002/profile/card#me' : 'BotService',
    'https://mycontributions.info/service/m/profile/card#me' : 'BotService',
    'http://host.docker.internal:3000/profile/card#me' : 'WikiService',
    'https://wiki.mycontributions.info/profile/card#me' : 'WikiService',
    'http://host.docker.internal:3001/profile/card#me' : 'MetadataService',
    'https://mycontributions.info/service/x/profile/card#me' : 'MetadataService',
    'http://host.docker.internal:3006/profile/card#me' : 'ClaimService',
    'https://mycontributions.info/service/c/profile/card#me' : 'ClaimService'
};

function actorName(actor) {
    const id = actor?.id;
    const name = actor?.name || "";
    const type = ACTOR_TYPES[id];

    if (type) {
        return type;
    }
    else if (name.startsWith('Verification')) {
        return 'VerificationService';
    }
    else if (id && ( id.includes('@') || id.includes('mastodon')) ) {
        return 'Mastodon';
    }
    else {
        return 'BotService';
    }
}

function storyAdd(story,actor,target,notificationType,message) {
    if (message && message.length > 40) {
        message = 
            message.substring(0,20) + 
            '...' + 
            message.substring(message.length - 20);
    }

    story += `   ${actor} ->>+ ${target}: ${message}\n`;
    story += `   Note right of ${actor}: ${notificationType}\n`;

    return story;
}

function traceAdd(trace,time,actor,target,type,content) {
    let html_content;
    if (content && content.startsWith("http")) {
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

        if (evt.type === 'Offer' && actor === 'BotService' && target === 'WikiService') {
            story = storyAdd(story,actor,target,evt.type,evt.object.id);
            const citation = evt.object.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,citation);
        }
        else if (evt.type === 'Announce' && actor === 'BotService' && target === 'Mastodon') {
            story = storyAdd(story,actor,target,evt.type,evt.object.content);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.content);
        }
        else {
            story = storyAdd(story,actor,target,evt.type,evt.object.id);
            trace = traceAdd(trace,timeDiff,actor,target,evt.type,evt.object.id);
        }
   }

    console.log(story);

    const g_element = document.querySelector('#graphDiv');
    const { svg, bindFunctions } = await mermaid.render('pre', story);
    g_element.innerHTML = svg;

    if (bindFunctions) {
        bindFunctions(g_element);
    }

    const t_element = document.querySelector('#graphTrace');
    t_element.innerHTML = trace;
});