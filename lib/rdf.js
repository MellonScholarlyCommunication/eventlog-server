const RMLMapperWrapper = require('@rmlio/rmlmapper-java-wrapper');
const N3 = require('n3');
const { Writer } = N3;
const fs = require('fs');
const fsPath = require('path');
const { v4: uuidv4 } = require('uuid');

async function generateQuads(input, opts) {
    const what = uuidv4();

    const rml  = patchMapping(opts.rmlMap,what);
    const data = patchCSL(input);
    
    const wrapper = new RMLMapperWrapper(opts.rmlMapper,opts.tmp, true);
    const sources = {
        [`${what}.json`]: JSON.stringify(data)
    };
    
    const result = await wrapper.execute(rml, { sources, generateMetadata: false, asQuads: true});
    
    if (result) {
        return result.output;
    }
    else {
        return null;
    }
}

function mainSubjects(input) {
    const data = patchCSL(input);
    if (data) {
        return data.map( (item) => item['URL']).filter( (item) => item !== undefined );
    }
    else {
        return null;
    }
}

async function serializeQuads(quads, opts) {
    return new Promise( (resolve,reject) => {
        const writer = new Writer(opts);

        writer.addQuads(quads);
        writer.end( (error, result) => {
            if (error) {
                reject(error);
            }

            resolve(result);
        });
    });
}

function patchMapping(map,what) {
    const patched = map.replace(/%%FILE%%/g,`${what}.json`);
    return patched;
}

function patchCSL(data) {
    for (let i = 0 ; i < data.length ; i++) {
        // Set a URL when none is given
        if (! data[i]['URL']) {
            if (data[i]['DOI']) {
                data[i]['URL'] = `https://doi.org/${data[i]['DOI']}`;
            }
            else {
                console.error(`warning: data[${i}] no URL and no DOI!`);
            }
        }

        // Add unique identifiers to authors
        const author = data[i]['author'];
        if (author && Array.isArray(author)) {
            for (let j = 0 ; j < author.length ; j++) {
                author[j]['id'] = `urn:uuid:${uuidv4()}`;
            }
        }

         // Add unique identifiers to editors
         const editor = data[i]['editor'];
         if (editor && Array.isArray(editor)) {
             for (let j = 0 ; j < editor.length ; j++) {
                editor[j]['id'] = `urn:uuid:${uuidv4()}`;
             }
         }
    }

    return data;
}

module.exports = { generateQuads , serializeQuads , mainSubjects };