/* eslint-disable eqeqeq */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getHost, moneyFormatter, ordinalNum, timeAgo } from "../Util";
import AvatarImg from "../AvatarImg";
import { Icon } from "@iconify/react/dist/iconify.js";

function Song() {
    const { song } = useParams();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tablePage, setTablePage] = useState(0);

    const fetchData = async (page) => {
        try {
            setLoading(true);
            page = page ?? 0;
            const response = await fetch(getHost() + '/api/top/song?song=' + song + "&strum=" + searchParams.get("strum") + "&page=" + page);
            if (!response.ok) {
                throw new Error('Song not found.');
            }
            const data = await response.json();
            console.log(data);
            setTablePage(page);
            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);

    const prettySong = song.split('-');

    return (
        <div className='Content'>
            <div className='Contents'> 
                {loading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p>Error: {error}</p>
                ) : (
                    <>
                        <h1 className="davefont">{prettySong[0]}</h1>
                        <p>Difficulty: {prettySong[1]}</p>
                        {searchParams.get("strum") == 1 ? <span>Opponent Side</span> : <></>}
                        {renderScores(song, data, tablePage)}
                        <br></br>
                        {(tablePage > 0) ?
                            <button className='SvgButton' style={{float: 'left'}} onClick={() => {
                                fetchData(tablePage - 1);
                            }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                        : <></>}
                        
                        {(data.length === 15) ?
                        <button className='SvgButton' style={{float: 'right'}} onClick={() => {
                            fetchData(tablePage + 1);
                        }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                        : <></>}
                    </>
                )}
                <br></br>
                <RenderComments songId={song}></RenderComments>
            </div>
        </div>
    )
}

function renderScores(song, scores, page) {
    var children = [];

    let i = 1;
    let leader = null; 
    for (const score of scores) {
        if (i === 1 && page === 0) {
            leader = score;
        }
        //const date = new Date(Date.parse(score.submitted));
        children.push(<tr key={score.submitted}>
            <td>
                {ordinalNum(i + page * 15)}
            </td>
            <td>
                <a href={"/user/" + encodeURIComponent(score.player)}> {score.player} </a>
                <a title='View Replay' target="_blank" rel='noreferrer' style={{ float: 'right', color: 'var(--text-profile-color)' }} href={"psych-online://replay/" + score.id}>
                    <Icon width={20} icon="mdi:eye" />
                </a>
                {
                    (score.modURL && (score.modURL + '').startsWith('https://')) ?
                        <a title='View Mod URL' target="_blank" rel='noreferrer' style={{ float: 'right', color: 'var(--text-profile-color)' }} href={score.modURL}>
                            <Icon width={20} icon="material-symbols:dataset-linked-outline-rounded" />
                        </a>
                        :
                        <></>
                }
            </td>
            <td>
                {moneyFormatter.format(score.score)}
            </td>
            <td>
                {score.accuracy}%
            </td>
            <td>
                {score.points}
            </td>
            <td>
                {timeAgo.format(Date.parse(score.submitted))/*date.toLocaleDateString() + " " + date.toLocaleTimeString()*/}
            </td>
        </tr>);
        i++;
    }

    return (<>
        {leader ?
            <a href={"/user/" + encodeURIComponent(leader.player)} className='LeaderContainer'>
                <AvatarImg src={getHost() + "/api/avatar/" + encodeURIComponent(leader.player)}></AvatarImg>
                <div className="FlexBox">
                    <br></br>
                    <span className="BigText">1st</span><span className="BiggerText"> {leader.player} </span>
                    <br></br><span>Score: {moneyFormatter.format(leader.score)}</span>
                    <span>{leader.points}FP</span>
                    <br></br><span>Accuracy: {leader.accuracy}%</span>
                    <br></br><span>{timeAgo.format(Date.parse(leader.submitted))}</span>
                </div>
            </a>
        : <></>}
        <table>
            <tbody>
                <tr>
                    <td></td>
                    <td> Player </td>
                    <td> Score </td>
                    <td> Accuracy </td>
                    <td> Points </td>
                    <td> Submitted </td>
                </tr>
                {children}
            </tbody>
        </table>
    </>);
}

function RenderComments(props) {
    const [comments, setComments] = useState([{
        player: String,
        content: String,
        at: Number,
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchComments = async () => {
        try {
            const response = await fetch(getHost() + '/api/song/comments?id=' + props.songId);
            if (!response.ok) {
                throw new Error('Could not load song comments.');
            }
            const data = await response.json();
            setError(null);
            setComments(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchComments();
    }, []);

    if (loading)
        return (<p>Loading...</p>)
    if (error)
        return (<p>Error: {error}</p>);

    var commentsBody = [];
    
    for (const comment of comments) {
        const isNeg = comment.at < 0;
        const at = Math.abs(Math.floor(comment.at / 1000));
        let minutes = Math.floor(at / 60);
        let seconds = Math.floor(at % 60) + "";
        if (seconds.length == 1)
            seconds = "0" + seconds;
        commentsBody.push(
            <div className="Comment">
                <AvatarImg className="SmallerAvatar" src={getHost() + "/api/avatar/" + encodeURIComponent(comment.player)}></AvatarImg>
                <div>
                    <a href={"/user/" + comment.player}>{comment.player}</a> <br></br>
                    <span>{comment.content}</span> <br></br>
                    <span className="SmallText"> at {isNeg ? '-' : ''}{minutes}:{seconds}</span>
                </div>
            </div>
        );
    }

    if (commentsBody.length <= 0) {
        return <></>;
    }

    return (
        <div className="Comments">
            <h3> Song Comments: </h3>
            {commentsBody}
        </div>
    );
}

export default Song;