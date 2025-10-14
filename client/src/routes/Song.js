/* eslint-disable eqeqeq */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getHost, moneyFormatter, ordinalNum, timeAgo } from "../Util";
import AvatarImg from "../AvatarImg";
import { Icon } from "@iconify/react/dist/iconify.js";
import { TopCategorySelect, TopSortSelect } from "../components";

function Song() {
    const { song } = useParams();
    const [searchParams, setSearchParams] = useSearchParams()
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tablePage, setTablePage] = useState(0);

    const category = searchParams.get('category');
    const sort = searchParams.get('sort');

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(getHost() + '/api/top/song?song=' + song + "&strum=" + searchParams.get("strum") + "&page=" + tablePage + (category ? '&category=' + category : '') + (sort ? '&sort=' + sort : ''));
            if (!response.ok) {
                throw new Error('Song not found.');
            }
            const data = await response.json();
            console.log(data);
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
    }, [tablePage, searchParams]);

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
                    <a title='View Replay' target="_blank" rel='noreferrer' style={{ float: 'right', color: 'var(--text-profile-color)' }} href={"/api/score/replay?id=" + score.id}>
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
                {sort && sort.startsWith('misses') ?
                    <td>
                        {score.misses}
                    </td>
                : <></>}
            </tr>);
            i++;
        }

        return (<>
            {leader ?
                <a href={"/user/" + encodeURIComponent(leader.player)} className='LeaderContainer'>
                    <AvatarImg src={getHost() + "/api/user/avatar/" + encodeURIComponent(leader.player)}></AvatarImg>
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
                        {sort && sort.startsWith('misses') ?
                            <td>
                                Misses
                            </td>
                            : <></>}
                    </tr>
                    {children}
                </tbody>
            </table>
        </>);
    }

    const prettySong = song.split('-');

    return (
        <div className='Content'>
            <div className='Contents'> 
                <h1 className="davefont">{prettySong[0]}</h1>
                <p>Difficulty: {prettySong[1]}</p>
                {searchParams.get("strum") == 1 ? <span>Opponent Side</span> : <></>}
                {loading ? (
                    <center>Loading...</center>
                ) : error ? (
                    <center>Error: {error}</center>
                ) : data.length > 0 ? (
                    <>
                        {renderScores(song, data, tablePage)}
                    </>
                ) : <center> None. </center>}
                <br></br>
                <center> Time: <TopCategorySelect v={category} onSelect={(sel) => {
                    searchParams.set('category', sel);
                    if (!sel)
                        searchParams.delete('category');
                    setSearchParams(searchParams);

                    setTablePage(0);
                }} />
                &nbsp;
                Sort By: <TopSortSelect default={'score:desc'} v={sort} onSelect={(sel) => {
                    searchParams.set('sort', sel);
                    if (!sel)
                        searchParams.delete('sort');
                    setSearchParams(searchParams);

                    setTablePage(0);
                }} />
                </center>
                {(tablePage > 0) ?
                    <button className='SvgButton' style={{ float: 'left' }} onClick={() => {
                        setTablePage(tablePage - 1);
                    }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                    : <></>}

                {(data.length === 15) ?
                    <button className='SvgButton' style={{ float: 'right' }} onClick={() => {
                        setTablePage(tablePage + 1);
                    }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                    : <></>}
                <br></br>
                <RenderComments songId={song}></RenderComments>
            </div>
        </div>
    )
}

function RenderComments(props) {
    const [comments, setComments] = useState([{
        player: '',
        content: '',
        at: '',
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
                <AvatarImg className="SmallerAvatar" src={getHost() + "/api/user/avatar/" + encodeURIComponent(comment.player)}></AvatarImg>
                <div>
                    <a href={"/user/" + comment.player}>{comment.player}</a> <br></br>
                    <span>{comment.content}</span> <br></br>
                    <span className="SmallText"> at {isNeg ? '-' : ''}{minutes}:{seconds}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="Comments">
            <h3> Song Comments: </h3>
            {
                loading ? <center> Loading... </center> :
                error ? <center> Error: {error} </center> : 
                commentsBody.length == 0 ? <center> None. </center> :
                commentsBody
            }
        </div>
    );
}

export default Song;