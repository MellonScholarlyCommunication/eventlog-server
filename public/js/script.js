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
    
    for (let i = 0 ; i < events.length ; i++) {
        const evt = events[i];
        const actor = actorName(evt.actor);
        const target = actorName(evt.target);
        let message = '';

        let messageType = 'request';

        if (evt.type === 'Announce' && actor.startsWith('Mastodon')) {
            if (evt.object.url) {
                message = evt.object.url[0].href;
                messageType = 'request';
            }
        }
        else if (evt.type === 'Offer' && actor === 'Claimbot') {
            message = evt.object.id;
            messageType = 'request';
        } 
        else if (evt.type === 'Announce' && actor === 'MetadataService') {
            message = 'Service Result of metadata lookup'
            messageType = 'response';
        }
        else if (evt.type === 'Reject' && actor === 'MetadataService') {
            message = evt.object.object.id;
            messageType = 'response';
        }
        else if (evt.type === 'Announce' && actor === 'WikiService') {
            message = evt.object.id.replace(/^.*orcid/,'http://wiki.../orcid');
            messageType = 'response';
        }
        else if (evt.type === 'Announce' && actor === 'Claimbot') {
            message = evt.object.content.substring(0,40);
            messageType = 'response';
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

    console.log(story);

    const element = document.querySelector('#graphDiv');
    const { svg, bindFunctions } = await mermaid.render('pre', story);
    element.innerHTML = svg;

    if (bindFunctions) {
        bindFunctions(element);
    }
});