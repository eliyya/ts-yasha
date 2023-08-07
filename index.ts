import Source from './src/Source.js'
import TrackPlayer from './src/TrackPlayer.js'
import VoiceConnection from './src/VoiceConnection.js'

import Youtube from './src/api/Youtube.js'
import Soundcloud from './src/api/Soundcloud.js'
import Spotify from './src/api/Spotify.js'

export const api = {
    Youtube,
    Soundcloud,
    Spotify,
}

export {
    Source,
    TrackPlayer,
    VoiceConnection,
}
export * from './src/Track.js'
export * from './src/Error.js'
