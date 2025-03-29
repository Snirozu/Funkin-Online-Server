import { connect, model, Schema, Types } from "mongoose";

// this was written to see the performance between mongoose and prisma
// but both work at nearly the same speed so prisma stays
// also storing for future use

const User = model('User', new Schema({
    _id: Schema.Types.ObjectId,
    name: {
        type: String,
        unique: true
    },
    secret: String,
    joined: {
        type: Date,
        default: () => Date.now() + 7 * 24 * 60 * 60 * 1000
    },
    lastActive: {
        type: Date,
        default: () => Date.now() + 7 * 24 * 60 * 60 * 1000
    },
    points: Number,
    isMod: {
        type: Boolean,
        required: false
    },
    pendingFriends: [{
        type: String,
    }],
    friends: [{
        type: String,
    }],
    email: {
        type: String,
        unique: true
    },
    isBanned: {
        type: Boolean,
        required: false
    },
    bio: {
        type: String,
        required: false
    },
    profileHue: {
        type: Number,
        required: false
    },
    avgAccSum: {
        type: Number,
        required: false
    },
    avgAccSumAmount: {
        type: Number,
        required: false
    },
    country: {
        type: String,
        required: false
    },
    scores: [{
        type: Schema.Types.ObjectId,
        //ref: 'Score'
    }],
    reports: [{
        type: Schema.Types.ObjectId,
        //ref: 'Report'
    }],
    songComments: [{
        type: Schema.Types.ObjectId,
        //ref: 'SongComment'
    }],
}), 'User');

const Report = model('Report', new Schema({
    _id: Schema.Types.ObjectId,
    content: String,
    submitted: {
        type: Date,
        default: () => Date.now() + 7 * 24 * 60 * 60 * 1000
    },
    by: {
        type: Schema.Types.ObjectId,
        //ref: 'User'
    },
}), 'Report');

const SongComment = model('SongComment', new Schema({
    _id: Schema.Types.ObjectId,
    content: String,
    at: Number,
    by: {
        type: Schema.Types.ObjectId,
        //ref: 'User'
    },
    songid: {
        type: String,
        //ref: 'Song'
    },
}), 'SongComment');

const Song = model('Song', new Schema({
    _id: String,
    scores: [{
        type: Schema.Types.ObjectId,
        //ref: 'Score'
    }],
    comments: [{
        type: Schema.Types.ObjectId,
        //ref: 'SongComment'
    }],
}), 'Song');

const Score = model('Score', new Schema({
    _id: Schema.Types.ObjectId,
    replayData: String,
    score: Number,
    accuracy: Number,
    points: Number,
    sicks: Number,
    goods: Number,
    bads: Number,
    shits: Number,
    misses: Number,
    playbackRate: Number,
    strum: Number,
    submitted: {
        type: Date,
        default: () => Date.now() + 7 * 24 * 60 * 60 * 1000
    },
    modURL: {
        type: String,
    },
    songId: {
        type: String,
        //ref: 'Song',
    },
    player: {
        type: Types.ObjectId,
        //ref: 'User',
    },
}), 'Score');

export async function initDB() {
    await connect(process.env["DATABASE_URL"]);
}

export async function getTopScores(id: string, strum: number, page: number) {
    return await Score.find({
        songId: id,
        strum: strum,
    }, {
        score: 1,
        accuracy: 1,
        points: 1,
        player: 1,
        submitted: 1,
        _id: 1,
        misses: 1,
        modURL: 1,
        sicks: 1,
        goods: 1,
        bads: 1,
        shits: 1,
        playbackRate: 1,
    }, {
        limit: 15,
        skip: 15 * page,
        sort: {
            score: -1
        }
    });
}