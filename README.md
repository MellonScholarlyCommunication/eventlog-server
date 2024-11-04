# Event Log Server

A small event log server for demonstration purposes. Main purpose it displaying the tracelog that is stored in the internal Postgres database.

# Install

```
yarn install
npm link
```

# Configure

```
cp .env-example .env
```

# Run

```
yarn server
```

# Demo

Show the trace of the latest Event Log

```
http://localhost:8000/trace?artifact=latest
```

Show the trace of an Event log about `http://abc.org`:

```
http://localhost:8000/trace?artifact=http://abc.org
```

## Development mode (docker)

Start the postgres server:

```
yarn db-start
```

Stop the postgres server:

```
yarn db-stop
```

Run a psql shell:

```
yarn db-shell
```

## API

**initCache(param { name: string }) : boolean**

Drop and recreate an event log cache with name `name`.

**addCache(notification: any, context: any, param { name:string }) : string | null**

Add a new notification to the cache with name `name`. Optional provide the identifier of an ancestor notification in the context. Return the identifier of the stored notification or null on error.

Example context:

```
{
  "updated": "2024-10-10T10:35:40.972Z",
  "original": "urn:uuid:b6049038-f87f-42ec-918b-2b732ff3c209"
}
```

**getCache(id: string, param { name: string }) : any | null**

Return the notification with identifier `id` from the cache with name `name`.

**getCacheContext(id: string, param { name: string }) : any | null**

Return the notification context with identifier `id` from the cache with name `name`.

**listCache(dataPath: string | null , contextPath: string | null, param { name: string , limit: num , offset: num }): [string]**

Return a list of all notification identifiers from the cache with name `name`.

Optional provide a `dataPath` or `contextPath` to filter the notifications. Both follow the same syntax:

```
# Find all with actor.type equal to Person
actor.type=Person

# Find all with actor.type not equal to Person
actor.type!=Person

# Find all with object.url not set
object.url=NULL

# Finf all with object.ur set
object.url!=NULL
```
**removeCache(id: string, param { name: string} ) : boolean**

Remove from the cache with name `name` the notification with idenfitier `id`.