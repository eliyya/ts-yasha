import { Track, TrackStream, TrackStreams } from '../Track.js'
import { UnplayableError } from '../Error.js'
import { UnsupportedError } from 'js-common'

class FileStream extends TrackStream {
    is_file: boolean = false
    constructor (url: string, isfile?: boolean) {
        super(url)

        this.is_file = !!isfile
        this.setTracks(true, true) /* we don't know what kind of tracks are in this file */
    }

    override equals (other: FileStream) {
        return !!(other instanceof FileStream && this.url && this.url === other.url)
    }
}

class FileStreams extends TrackStreams {
    from (url: string, isfile?: boolean) {
        this.push(new FileStream(url, isfile))

        return this
    }
}

class FileTrack extends Track {
    stream_url: string
    isLocalFile: boolean
    constructor (url: string, isfile = false) {
        super('File')

        this.stream_url = url
        this.id = url
        this.isLocalFile = isfile
        this.setStreams(new FileStreams().from(url, isfile))
    }

    override async getStreams () {
        throw new UnplayableError({ simpleMessage: 'Stream expired or not available' })
    }

    override async fetch () {
        throw new UnsupportedError('Cannot fetch on a FileTrack')
    }

    override get url () {
        return this.stream_url
    }
}

class File {
    async get (_url: string) {
        throw new UnsupportedError()
    }

    async get_streams (_url: string) {
        throw new UnsupportedError()
    }

    async playlist (_url: string, _length: number) {
        throw new UnsupportedError()
    }

    create (url: string, isfile?: boolean) {
        return new FileTrack(url, isfile)
    }
}

export default new File()
export {
    Track as FileTrack,
}
