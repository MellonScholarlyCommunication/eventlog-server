
const postgres = require('postgres');
const logger = require('./util').getLogger();

function connect() {
    const host     = process.env.POSTGRES_HOST || '127.0.0.1';
    const port     = process.env.POSTGRES_PORT || 5432;
    const database = process.env.POSTGRES_DATABASE;
    const username = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;

    logger.debug(`connecting to postgres://${host}:${port} ${username}@${database}`);
    
    return postgres({ 
        host: host,
        port: port,
        database: database,
        username: username,
        password: password
    });
}

async function initCache(param) {
    const sql = connect();

    let tries = 1;

    while (1) {
        try {
            if (tries == 5) {
                logger.error(`I give up...`);
                break;
            }
            logger.debug(`dropping ${param.name}...`);

            if (param.drop) {
                await sql`DROP TABLE IF EXISTS ${sql(param.name)};`;
            }

            await sql`
        CREATE TABLE IF NOT EXISTS ${sql(param.name)} (
            id varchar(120) PRIMARY KEY,
            data JSON NOT NULL,
            context JSONB NOT NULL,
            created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        `;
            sql.end();
            return true;
        }
        catch (e) {
            logger.error(`database fails to respond trying again ...[${tries}]`);
            logger.trace(e);

            await new Promise(resolve => setTimeout(resolve, 2000 * tries));
            
            tries++;
        }
    }

    return false;
}

async function addCache(notification,context = {},param) {
    logger.debug(`addCache(${notification},${context},${param})`);

    let data;

    if ( ! notification) {
        logger.error(`got an empty notification`);
        return null;
    }

    if (typeof notification === 'string' || notification instanceof String) {
        data = JSON.parse(notification);
    }
    else {
        data = notification;
    }

    if (! data.id) {
        logger.error(`notification has no id?`);
        logger.error(data);
        return null;
    }

    const sql = connect();

    const record = {
        id: data.id ,
        data: data,
        context: context,
        created: context && context.updated ? 
            context.updated : (new Date()).toISOString()
    };

    await sql`
        INSERT INTO ${sql(param.name)} ${
            sql(record, 'id', 'data', 'context', 'created')
        } ON CONFLICT (id) DO UPDATE SET data = ${record.data}, context = ${record.context}, created = ${record.created}`;

    sql.end();

    return notification.id;
}

async function getCache(id,param) {
    const sql = connect();
    
    const result = await sql`
        SELECT data FROM ${sql(param.name)} WHERE id = ${id}
    `;

    let json = null;

    if (result.length > 0) {
        json = result[0].data;
    }

    sql.end();

    return json;
}

async function getCacheContext(id,param) {
    const sql = connect();
    
    const result = await sql`
        SELECT context, created FROM ${sql(param.name)} WHERE id = ${id}
    `;

    let json;

    if (result.length > 0) {
        json = result[0].context;
        json['updated'] ||= result[0].created;
    }

    sql.end();

    return json;
}

async function listCache(dataPath,contextPath,param) {
    if (! await isExistingTable(param.name) ) { 
        return [];
    }

    const sql = connect();
    
    const dataFilter = makeQuery('data',dataPath);
    const contextFilter = makeQuery('context',contextPath);

    let query = `SELECT * FROM ${param.name}`;

    const parts = [];

    if (dataFilter) {
        parts.push(dataFilter);
    }
        
    if (contextFilter) {
        parts.push(contextFilter);
    }

    if (param.from) {
        parts.push(`created::date >= '${param.from}'`);
    }

    if (param.until) {
        parts.push(`created::date < '${param.until}'`);
    }

    if (parts.length > 0) {
        query += ` WHERE ${parts.join(' AND ')}`;
    }

    query += ` ORDER BY created ASC`;

    if (param.limit && param.limit.match(/^\d+$/)) {
        query += ` LIMIT ${param.limit}`;
    }

    if (param.offset && param.offset.match(/^\d+$/)) {
        query += ` OFFSET ${param.offset}`;
    }

    logger.debug(`sql: ${query}`);

    const result = await sql.unsafe(query);

    const list = result.map( (entry) => { return entry.id });

    sql.end();

    return list;
}

async function removeCache(id,param) {
    const sql = connect();
 
    const result = await sql`
        DELETE FROM ${sql(param.name)} WHERE id = ${id} RETURNING *
    `;

    sql.end();

    return result.length === 1 ? true : false;
}

async function isExistingTable(name) {
    const sql = connect();

    const result = await sql.unsafe(
    `
SELECT EXISTS ( SELECT 1 FROM information_schema.tables WHERE table_name = '${name}')
    `);

    const res = result[0].exists;

    sql.end();

    return res;
}

function makeQuery(index,str) {
    if (! str) 
        return null;

    const matches = str.match(/^(\w+(\.\w+)*)\s*(=|!=)\s*(.*)/);

    if (! matches) 
        return null;

    const path = matches[1]
                    .split(/\./)
                    .map( (x) => `'${x}'`)
                    .join("->")
                    .replace(/('\w+')$/,">$1");
    const operator = matches[3];
    const value = matches[4].replace(/'/,"\\\'");

    if (value === 'NULL') {
        if (operator === '=') {
            return `${index}::jsonb->${path} IS NULL`;
        }
        else {
            return `${index}::jsonb->${path} IS NOT NULL`;
        }
    }
    else {
        return `${index}::jsonb->${path} ${operator} '${value}'`;
    }
}

module.exports = { 
    initCache ,
    addCache ,
    getCache ,
    getCacheContext ,
    listCache ,
    removeCache 
};