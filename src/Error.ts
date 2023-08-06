import { GenericError } from 'js-common'

class UnplayableError extends GenericError {
    constructor (arg: any) {
        super(arg, 'Track is unplayable')
    }
}

class NotATrackError extends GenericError {
    constructor (arg: any) {
        super(arg, 'Link does not lead to a track')
    }
}

export {
    UnplayableError,
    NotATrackError,
}
