import Request from '../Request.js'

import { Track, TrackImage, TrackResults, TrackPlaylist, TrackStream, TrackStreams } from '../Track.js'
import { UnplayableError, NotATrackError } from '../Error.js'
import { InternalError, NetworkError, NotFoundError, ParseError } from 'js-common'

export class SoundcloudTrack extends Track {
    declare platform: 'Soundcloud'
    permalink_url?: string
    constructor () {
        super('Soundcloud')
    }

    from (track: { permalink_url: any, user: { username: string, avatar_url: any }, id: string, title: string, duration: number }) {
        this.permalink_url = track.permalink_url

        const streams = new SoundcloudStreams().from(track)

        if (streams.length) { this.setStreams(streams) }
        return this.setOwner(
            track.user.username,
            [{ url: track.user.avatar_url, width: 0, height: 0 }],
        ).setMetadata(
            track.id + '',
            track.title,
            track.duration / 1000,
            TrackImage.from(this.get_thumbnails(track)),
        )
    }

    get_thumbnails (track: { permalink_url?: any, user: any, id?: string, title?: string, duration?: number, artwork_url?: any }) {
        const sizes = [20, 50, 120, 200, 500]
        const visualSizes = [[1240, 260], [2480, 520]]

        const defaultThumbnail = track.artwork_url || track.user.avatar_url
        const multires = /^.*\/(\w+)-([-a-zA-Z0-9]+)-([a-z0-9]+)\.(jpg|png|gif).*$/i.exec(defaultThumbnail)

        const thumbnails = []

        if (multires) {
            const type = multires[1]
            const size = multires[3]

            if (type === 'visuals') {
                for (const sz of visualSizes) {
                    thumbnails.push({
                        width: sz[0],
                        height: sz[1],
                        url: defaultThumbnail.replace(size, 't' + sz[0] + 'x' + sz[1]),
                    })
                }
            } else {
                for (const sz of sizes) {
                    let rep

                    if (type === 'artworks' && sz === 20) { rep = 'tiny' } else { rep = 't' + sz + 'x' + sz }
                    thumbnails.push({
                        width: sz,
                        height: sz,
                        url: defaultThumbnail.replace(size, rep),
                    })
                }
            }
        } else {
            /* default image */
            thumbnails.push({
                url: defaultThumbnail,
                width: 0,
                height: 0,
            })
        }

        return thumbnails
    }

    async fetch () {
        return await api.get(this.id ?? '')
    }

    async getStreams () {
        return await api.get_streams(this.id ?? '')
    }

    get url () {
        return this.permalink_url
    }
}

export class SoundcloudResults extends TrackResults {
    query?: string
    start?: number
    set_continuation (query: string, start: number) {
        this.query = query
        this.start = start
    }

    override async next () {
        return await api.search(this.query ?? '', this.start ?? 0)
    }
}

export class SoundcloudPlaylist extends TrackPlaylist {
    declare platform: 'Soundcloud'
    permalink_url?: string
    id?: string
    start?: number
    from (list: { permalink_url: any, title: string, description: string }) {
        this.permalink_url = list.permalink_url
        this.setMetadata(list.title, list.description)

        return this
    }

    set_continuation (id?: string, start?: number) {
        this.id = id
        this.start = start
    }

    override get url () {
        return this.permalink_url
    }

    override async next () {
        if (this.id) { return await api.playlist_once(this.id, this.start) }
        return null
    }
}

export class SoundcloudStream extends TrackStream {
    stream_url: string
    constructor (url: string) {
        super(url)

        this.stream_url = url
    }

    override async getUrl () {
        const body = await api.request(this.stream_url)

        if (body?.url) { return body.url }
        throw new UnplayableError('No stream url found')
    }
}

export class SoundcloudStreams extends TrackStreams {
    from (track: { permalink_url?: any, user?: { username: string, avatar_url: any }, id?: string, title?: string, duration?: number, media?: any }) {
        if (track.media?.transcodings) {
            this.set(1, false, Date.now())
            this.extract_streams(track.media.transcodings)
        }

        return this
    }

    extract_streams (streams: any) {
        for (const stream of streams) {
            let [, container, codecs] = /audio\/([a-zA-Z0-9]{3,4})(?:;(?:\+| )?codecs="(.*?)")?/.exec(stream.format.mime_type) ?? []

            if (container === 'mpeg' && !codecs) { codecs = 'mp3' }
            this.push(
                new SoundcloudStream(stream.url)
                    .setDuration(stream.duration / 1000)
                    .setBitrate(-1)
                    .setTracks(false, true)
                    .setMetadata(container, codecs),
            )
        }
    }

    override expired () {
        return false
    }

    override maybeExpired () {
        return false
    }
}

export class SoundcloudAPI {
    client_id: string

    Track = SoundcloudTrack
    Results = SoundcloudResults
    Playlist = SoundcloudPlaylist
    constructor () {
        this.client_id = 'dbdsA8b6V6Lw7wzu1x0T4CLxt58yd4Bf'
    }

    async request (path: string, query: { [key: string]: any } = {}) {
        let res; let body; let queries = []

        for (let tries = 0; tries < 2; tries++) {
            query.client_id = this.client_id
            queries = []

            for (const name in query) { queries.push(name + '=' + query[name]) }
            res = (await Request.getResponse(path + '?' + queries.join('&'))).res

            if (res.status === 401) { throw new InternalError('Unauthorized') }
        }

        try {
            body = await res?.text()
        } catch (e) {
            if (!res?.ok) { throw new InternalError(e) }
            throw new NetworkError(e)
        }

        if (res?.status === 404) { throw new NotFoundError() }
        if (!res?.ok) { throw new InternalError(body) }
        try {
            body = JSON.parse(body ?? '')
        } catch (e) {
            throw new ParseError(e)
        }

        return body
    }

    async api_request (path: string, query?: { [key: string]: any }) {
        return await this.request('https://api-v2.soundcloud.com/' + path, query)
    }

    async resolve_playlist (list: { tracks?: any, id?: any, permalink_url: any, title: string, description: string }, offset = 0, limit: number) {
        let unresolvedIndex = -1
        const tracks = new SoundcloudPlaylist()

        if (!list || typeof list !== 'object' || !(list.tracks instanceof Array)) { throw new InternalError('Invalid list') }
        if (offset === 0) { tracks.from(list) }
        if (offset >= list.tracks.length) { return null }
        try {
            for (let i = offset; i < list.tracks.length; i++) {
                if (list.tracks[i].streamable === undefined) {
                    unresolvedIndex = i

                    break
                }

                tracks.push(new SoundcloudTrack().from(list.tracks[i]))
            }
        } catch (e) {
            throw new InternalError(e)
        }

        if (!limit || limit + offset > list.tracks.length) { limit = list.tracks.length } else { limit += offset }
        while (unresolvedIndex !== -1 && unresolvedIndex < limit) {
            const ids = list.tracks.slice(unresolvedIndex, unresolvedIndex + 50)
            const body = await this.api_request('tracks', { ids: ids.map(track => track.id).join(',') })

            try {
                if (!body.length) { break }
                for (const track of body) { tracks.push(new SoundcloudTrack().from(track)) }
            } catch (e) {
                throw new InternalError(e)
            }

            unresolvedIndex += body.length
        }

        tracks.set_continuation(list.id, offset + tracks.length)

        return tracks
    }

    async resolve (url: string) {
        const body = await this.api_request('resolve', { url: encodeURIComponent(url) })

        if (body.kind === 'track') {
            try {
                return new SoundcloudTrack().from(body)
            } catch (e) {
                throw new InternalError(e)
            }
        } else if (body.kind === 'playlist') {
            return await this.resolve_playlist(body, 0, 50)
        } else {
            throw new NotATrackError('Unsupported kind: ' + body.kind)
        }
    }

    async resolve_shortlink (id: string) {
        let res, body, location, url

        url = 'https://on.soundcloud.com/' + encodeURIComponent(id)

        for (let redirects = 0; redirects < 5; redirects++) {
            res = (await Request.getResponse(url, { redirect: 'manual' })).res

            try {
                body = await res.text()
            } catch (e) {
                if (!res.ok) { throw new InternalError(e) }
                throw new NetworkError(e)
            }

            if (res.status === 404) { throw new NotFoundError() }
            if (res.status !== 302 || !res.headers.has('Location')) { throw new InternalError(body) }
            location = res.headers.get('Location') ?? ''

            try {
                location = new URL(location, 'https://on.soundcloud.com/')
            } catch (e) {
                throw new ParseError('Invalid redirect URL: ' + location)
            }

            url = location.href

            if (location.hostname === 'soundcloud.com' && location.pathname.startsWith('/') && location.pathname.length > 1) { return await this.resolve(url) }
        }

        throw new ParseError('Too many redirects')
    }

    check_valid_id (id: string) {
        if (!/^[\d]+$/.test(id)) { throw new NotFoundError() }
    }

    async get (id: string) {
        this.check_valid_id(id)

        const body = await this.api_request('tracks/' + id)

        let track

        try {
            track = new SoundcloudTrack().from(body)
        } catch (e) {
            throw new InternalError(e)
        }

        if (!track.streams) { throw new UnplayableError('No streams found') }
        return track
    }

    async get_streams (id: string) {
        this.check_valid_id(id)

        const body = await this.api_request('tracks/' + id)

        let streams

        try {
            streams = new SoundcloudStreams().from(body)
        } catch (e) {
            throw new InternalError(e)
        }

        if (!streams.length) { throw new UnplayableError('No streams found') }
        return streams
    }

    async search (query: string, offset: number, limit = 20) {
        const body = await this.api_request('search/tracks', { q: encodeURIComponent(query), limit, offset })

        try {
            const results = new SoundcloudResults()

            for (const item of body.collection) { results.push(new SoundcloudTrack().from(item)) }
            if (body.collection.length) { results.set_continuation(query, offset + limit) }
            return results
        } catch (e) {
            throw new InternalError(e)
        }
    }

    async playlist_once (id: string, offset = 0, limit = 50) {
        this.check_valid_id(id)

        const body = await this.api_request('playlists/' + id)

        return await this.resolve_playlist(body, offset, limit)
    }

    async playlist (id: string, limit?: number) {
        return await this.playlist_once(id, 0, limit)
    }
}
const api = new SoundcloudAPI()

export default api
