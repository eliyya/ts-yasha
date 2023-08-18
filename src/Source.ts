import { NotATrackError } from './Error.js'
import { Youtube as YoutubeAPI, Soundcloud as SoundcloudAPI, Spotify as SpotifyAPI, AppleMusic as AppleMusicAPI, File as FileAPI } from '../api.js'

const youtube = new class Youtube {
    id_regex = /^([\w_-]{11})$/
    platform = 'Youtube'
    api = YoutubeAPI

    weak_match (id: string) {
        if (this.id_regex.exec(id)) { return { id } }
        return null
    }

    match (content: string | URL) {
        let url

        try {
            url = new URL(content)
        } catch (e) {
            return null
        }

        let id = null; let list = null

        if (url.hostname === 'youtu.be') { id = url.pathname.substring(1) } else if ((url.hostname === 'www.youtube.com' || url.hostname === 'music.youtube.com' || url.hostname === 'youtube.com') && url.pathname === '/watch') { id = url.searchParams.get('v') }
        let match = this.weak_match(id as string)

        list = url.searchParams.get('list')

        if (!list) { return match }
        // @ts-expect-error
        if (!match) { match = {} }
        // @ts-expect-error
        match.list = list

        return match
    }

    async resolve (match: { soundcloud: string, shortlink?: undefined } | { shortlink: string, soundcloud?: undefined } | { track: string, playlist?: undefined, album?: undefined } | { playlist: string, track?: undefined, album?: undefined } | { album: string, track?: undefined, playlist?: undefined } | { id: any }) {
        let track = null; let list = null

        // @ts-expect-error
        if (match.id) { track = this.api.get(match.id) }
        // @ts-expect-error
        if (match.list) { list = this.api.playlist_once(match.list) }
        const result = await Promise.allSettled([track, list])

        // @ts-expect-error
        track = result[0].value
        // @ts-expect-error
        list = result[1].value

        // @ts-expect-error
        if (!track && !list) { throw match.id ? result[0].reason : result[1].reason }
        if (list) {
            if (track) { list.setFirstTrack(track) }
            return list
        }

        return track
    }

    async weak_resolve (match: any) {
        try {
            return await this.resolve(match)
        } catch (e) {
            return null
        }
    }

    async search (query: any, continuation: any, _?: any) {
        return await this.api.search(query, continuation)
    }

    async playlistOnce (id: any, start: any, _?: any) {
        return await this.api.playlist_once(id, start)
    }

    setCookie (cookie: any) {
        this.api.set_cookie(cookie)
    }
}()

const soundcloud = new class Soundcloud {
    platform = 'Soundcloud'
    api = SoundcloudAPI

    match (content: string | URL) {
        let url

        try {
            url = new URL(content)
        } catch (e) {
            return null
        }

        if (url.pathname.startsWith('/') && url.pathname.length > 1) {
            if (url.hostname === 'soundcloud.com') { return { soundcloud: url.href } } else if (url.hostname === 'on.soundcloud.com') { return { shortlink: url.pathname.substring(1) } }
        }

        return null
    }

    async resolve (match: { soundcloud: string, shortlink?: undefined } | { shortlink: string, soundcloud?: undefined } | { track: string, playlist?: undefined, album?: undefined } | { playlist: string, track?: undefined, album?: undefined } | { album: string, track?: undefined, playlist?: undefined } | { id: any }) {
        try {
            // @ts-expect-error
            if (match.shortlink) { return await this.api.resolve_shortlink(match.shortlink) }
            // @ts-expect-error
            return await this.api.resolve(match.soundcloud)
        } catch (e) {
            if (e instanceof NotATrackError) { return null }
            throw e
        }
    }

    async search (query: any, offset: any, length: any) {
        return await this.api.search(query, offset, length)
    }

    async playlistOnce (id: any, offset: any, length: any) {
        return await this.api.playlist_once(id, offset, length)
    }
}()

const spotify = new class Spotify {
    platform = 'Spotify'
    api = SpotifyAPI

    match (content: string | URL) {
        let url

        try {
            url = new URL(content)
        } catch (e) {
            return null
        }

        if (url.hostname === 'open.spotify.com' && url.pathname.startsWith('/') && url.pathname.length > 1) {
            const data = url.pathname.substring(1).split('/')

            if (data.length !== 2) { return null }
            switch (data[0]) {
                case 'track':
                    return { track: data[1] }
                case 'album':
                    return { album: data[1] }
                case 'playlist':
                    return { playlist: data[1] }
            }
        }

        return null
    }

    async resolve (match: { soundcloud: string, shortlink?: undefined } | { shortlink: string, soundcloud?: undefined } | { track: string, playlist?: undefined, album?: undefined } | { playlist: string, track?: undefined, album?: undefined } | { album: string, track?: undefined, playlist?: undefined } | { id: any }) {
        // @ts-expect-error
        if (match.track) { return await this.api.get(match.track) }
        // @ts-expect-error
        if (match.playlist) { return await this.api.playlist_once(match.playlist) }
        // @ts-expect-error
        if (match.album) { return await this.api.album_once(match.album) }
    }

    async search (query: any, offset: any, length: any) {
        return await this.api.search(query, offset, length)
    }

    async playlistOnce (id: any, offset: any, length: any) {
        return await this.api.playlist_once(id, offset, length)
    }

    async albumOnce (id: any, offset: any, length: any) {
        return await this.api.album_once(id, offset, length)
    }

    setCookie (cookie: any) {
        this.api.set_cookie(cookie)
    }
}()

const apple = new class AppleMusic {
    api = AppleMusicAPI
    platform = 'AppleMusic'

    match (content: string | URL | undefined) {
        let url

        try {
            url = new URL(content as string)
        } catch (e) {
            return null
        }

        if (url.hostname === 'music.apple.com' && url.pathname.startsWith('/') && url.pathname.length > 1) {
            const path = url.pathname.substring(1).split('/')

            if (path.length < 2) { return null }
            if (path[0] !== 'playlist' && path[0] !== 'album' && path[0] !== 'song') { path.shift() }
            if (path.length < 2) { return null }
            switch (path[0]) {
                case 'song':
                    return { track: path[1] }
                case 'playlist':
                    return { playlist: path[2] ?? path[1] }
                case 'album':{
                    const track = url.searchParams.get('i')

                    if (track) { return { track } }
                    return { album: path[2] ?? path[1] }
                }
            }
        }

        return null
    }

    async resolve (match: { soundcloud: string, shortlink?: undefined } | { shortlink: string, soundcloud?: undefined } | { track: string, playlist?: undefined, album?: undefined } | { playlist: string, track?: undefined, album?: undefined } | { album: string, track?: undefined, playlist?: undefined } | { id: any }) {
        // @ts-expect-error
        if (match.track) { return await this.api.get(match.track) }
        // @ts-expect-error
        if (match.playlist) { return await this.api.playlist_once(match.playlist) }
        // @ts-expect-error
        if (match.album) { return await this.api.album_once(match.album) }
    }

    async search (query: any, offset: any, length: any) {
        return await this.api.search(query, offset, length)
    }

    async playlistOnce (id: any, offset: any, length: any) {
        return await this.api.playlist_once(id, offset, length)
    }

    async albumOnce (id: any, offset: any, length: any) {
        return await this.api.album_once(id, offset, length)
    }
}()

const file = new class File {
    api = FileAPI
    platform = 'File'

    async resolve (content: string) {
        let url

        try {
            url = new URL(content)
        } catch (e) {
            return null
        }

        if (url.protocol === 'http:' || url.protocol === 'https:') { return this.api.create(content) }
        if (url.protocol === 'file:') { return this.api.create(content, true) }
        return null
    }
}()

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Source {
    static Youtube = youtube
    static Soundcloud = soundcloud
    static Spotify = spotify
    static AppleMusic = apple
    static File = file
    static resolve (input: string | null, weak = true) {
        const sources = [youtube, soundcloud, spotify, apple]
        let match

        for (const source of sources) {
            // eslint-disable-next-line no-cond-assign
            if (match = source.match(input as string)) { return source.resolve(match) }
        }
        if (!weak) { return null }
        for (const source of sources) {
            // @ts-expect-error
            // eslint-disable-next-line no-cond-assign
            if (match = source.weak_match(input as string)) { return source.weak_resolve(match) }
        }
        return null
    }
};

export default Source
