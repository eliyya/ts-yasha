import {
    search_continuation as SearchContinuation,
    playlist_params as PlaylistParams,
    playlist_offset as PlaylistOffset,
    search_filters as SearchFilters,
    search_options as SearchOptions,
    search_sort as searchSort,
    playlist as Playlist,
    search as Search,
} from './build/youtube.js'

function binaryToB64NoPad (binary: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): string {
    return Buffer.from(binary).toString('base64url')
}

function binB64 (binary: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): string {
    let str = binaryToB64NoPad(binary)

    while (str.length & 3) { str += '=' }
    return str
}

function binaryToB64url (binary: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): string {
    return encodeURIComponent(binB64(binary))
}

function b64urlToBinary (input: string): Buffer {
    return Buffer.from(decodeURIComponent(input), 'base64')
}

export function playlistNextOffset (continuation: string): undefined | number {
    const p = Playlist.deserializeBinary(b64urlToBinary(continuation))

    if (!p.continuation?.params) return
    const pParams = PlaylistParams.deserializeBinary(b64urlToBinary(p.continuation.params))

    if (!pParams.offset) return

    return PlaylistOffset.deserializeBinary(b64urlToBinary(pParams.offset.substring('PT:'.length))).offset
}

export function genPlaylistContinuation (id: string, offset: number): string {
    const pOffset = new PlaylistOffset()
    const pParams = new PlaylistParams()
    // eslint-disable-next-line new-cap
    const pCont = new Playlist.playlist_continuation()
    const p = new Playlist()
    pOffset.offset = offset
    pParams.page = Math.floor(offset / 100)
    pParams.offset = `PT:${offset ? binaryToB64NoPad(pOffset.serializeBinary()) : 'CAA'}`
    pCont.vlid = 'VL' + id
    pCont.params = binaryToB64url(pParams.serializeBinary())
    pCont.id = id
    p.continuation = pCont

    return binaryToB64url(p.serializeBinary())
}

export function genSearchContinuation (query: string, offset: number): string {
    const sCont = new SearchContinuation()
    // eslint-disable-next-line new-cap
    const sData = new SearchContinuation.search_data()
    const sFilters = new SearchFilters()
    const sOptions = new SearchOptions()
    // eslint-disable-next-line new-cap
    const sPosition = new SearchOptions.search_position()
    // eslint-disable-next-line new-cap
    const sOff = new SearchOptions.search_position.off()
    sOff.total = 0
    sOff.page = 1
    sPosition.offset = sOff
    sOptions.sort = searchSort.RELEVANCE
    sFilters.type = SearchFilters.Type.VIDEO
    sOptions.filters = sFilters
    sOptions.offset = offset
    sOptions.position = sPosition
    sData.query = query
    sData.options = binaryToB64url(sOptions.serializeBinary())
    sCont.data = sData
    sCont.const = 52047873
    sCont.type = 'search-feed'

    return binaryToB64url(sCont.serializeBinary())
}

export type SearchSortString = 'relevance' | 'rating' | 'upload_date' | 'view_count'
export type SearchTypeString = 'video' | 'channel' | 'playlist' | 'movie'
export type SearchDurationString = 'short' | 'medium' | 'long'
export interface SearchOptionsType {
    sort: SearchSortString
    type: string
    duration: SearchDurationString
    features?: {
        hd?: boolean
        cc?: boolean
        creativeCommons?: boolean
        is3d?: boolean
        live?: boolean
        purchased?: boolean
        is4k?: boolean
        is360?: boolean
        location?: boolean
        hdr?: boolean
        vr180?: boolean
    }
}
export function genSearchOptions (opts: SearchOptionsType): string {
    const options = new Search()
    const filters = new SearchFilters()
    options.sort = searchSort[opts.sort.toUpperCase() as keyof typeof searchSort]
    filters.type = SearchFilters.Type[opts.type.toUpperCase() as keyof typeof SearchFilters.Type]
    filters.duration = SearchFilters.Duration[opts.duration.toUpperCase() as keyof typeof SearchFilters.Duration]
    filters.is_hd = !!opts.features?.hd
    filters.has_cc = !!opts.features?.cc
    filters.creative_commons = !!opts.features?.creativeCommons
    filters.is_3d = !!opts.features?.is3d
    filters.is_live = !!opts.features?.live
    filters.purchased = !!opts.features?.purchased
    filters.is_4k = !!opts.features?.is4k
    filters.is_360 = !!opts.features?.is360
    filters.has_location = !!opts.features?.location
    filters.is_hdr = !!opts.features?.hdr
    filters.is_vr180 = !!opts.features?.vr180
    options.filters = filters

    return binaryToB64url(options.serializeBinary())
}
