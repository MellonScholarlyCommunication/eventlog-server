#!/usr/bin/env node

const { program } = require('commander');
const cache = require('../lib');
const fs = require('fs');
const chalk = require('chalk');

require('dotenv').config();

const CACHE_NAME = process.env.CACHE_NAME || "cache";

program
    .name('event_admin.js')
    .option(`--name <name>`,'Name of cache table', CACHE_NAME);

program
    .command('init')
    .action( async() => {
        const result = await cache.initCache(program.opts());
        console.log(result);
    });

program
    .command('list')
    .option('-qp,--query-path <path_query>','data query')
    .option('-cp,--context-path <path_query>','context query')
    .action( async (opts) => {
        const result = await cache.listCache(opts.queryPath,opts.contextPath, program.opts());
        console.log(result);
    });

program
    .command('get')
    .option('-c,--context')
    .argument('<id>','cache identifier')
    .action( async (id,opts) => {
        if (opts.context) {
            const result = await cache.getCacheContext(id,program.opts());
            console.log(JSON.stringify(result,null,2));
        }
        else {
            const result = await cache.getCache(id,program.opts());
            console.log(JSON.stringify(result,null,2));
        }
    });

program
    .command('export')
    .option('-qp,--query-path <path_query>','data query')
    .option('-cp,--context-path <path_query>','context query')
    .option('--context')
    .argument('<directory>','output directory')
    .action( async (directory,opts) => {
        const result = await cache.listCache(opts.queryPath,opts.contextPath, program.opts());

        if (! fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        for (let i = 0 ; i < result.length ; i++) {
            const id = result[i];
            const data = await cache.getCache(id,program.opts());

            console.log(`${directory}/${id}.json`);
            fs.writeFileSync(`${directory}/${id}.json`,JSON.stringify(data,null,2));

            if (opts.context) {
                const context = await cache.getCacheContext(id,program.opts());

                console.log(`${directory}/${id}.json.meta`);
                fs.writeFileSync(`${directory}/${id}.json.meta`,JSON.stringify(context,null,2));
            }
        } 
    });

program
    .command('add')
    .argument('<file...>','json notification')
    .action( async (file) => {
        for (let i = 0 ; i < file.length ; i++) {
            const json = file[i];
            const data = JSON.parse(fs.readFileSync(json, { encoding: 'utf-8'}));
            const context = {};
            if (data.original) {
                // Hack to inject an original in the data for test purposes...
                context['original'] = data.original;
            }
            else if (fs.existsSync(`${json}.meta`)) {
                context = JSON.parse(fs.readFileSync(`${json}.meta`, { encoding: 'utf8'}));
            }
            const result = await cache.addCache(data,context,program.opts());
            console.log(result);
        }
    });

program
    .command('remove')
    .argument('<id>','cache identifier')
    .action( async (id) => {
        const result = await cache.removeCache(id,program.opts())
        console.log(result);
    });

program
    .command('remove-all')
    .action( async () => {
        const list = await cache.listCache(null,null,program.opts());
        for (let i = 0 ; i < list.length ; i++) {
            const result = await cache.removeCache(list[i],program.opts());
            console.log(`${list[i]} ${result}`);
        }
    });

program
    .command('summary')
    .argument('[id]', 'for this identifier')
    .action( async (id) => {
        if (id) {
            await summaryFor(id);
        
            const list = await cache.listCache('',`original=${id}`,program.opts());
            for (let i = 0 ; i < list.length ; i++) {
                await summaryFor(list[i],2);
            }
        }
        else {
            const list = await cache.listCache('','original=NULL',program.opts());

            for (let i = 0 ; i < list.length ; i++) {
                await summaryFor(list[i]);
            }
        }
    });

program.parse();

async function summaryFor(thisId,spacing = 0) {

    const notification = await cache.getCache(thisId,program.opts());
    const context = await cache.getCacheContext(thisId,program.opts());

    if (! (notification && context)) {
        return;
    }
    
    const id = notification.id;
    const type = notification.type;
    const actor = notification.actor.id;
    const object = notification.object.id;
    const updated = context.updated;

    let sp = ' '.repeat(spacing); 
    
    console.log(`${sp}${chalk.blue(id)} ${chalk.red(type)}`);
    console.log(`${sp} ${chalk.yellow('from')}: ${actor}`);
    console.log(`${sp} ${chalk.yellow('object')}: ${object}`);
    console.log(`${sp} ${chalk.yellow('updated')}: ${updated}`);
    
    if (context.original) {
        console.log(`${sp} ${chalk.yellow('original')}: ${chalk.blue(context.original)}`);
    }

    console.log();
}
