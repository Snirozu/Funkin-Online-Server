/* eslint-disable eqeqeq */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getHost, ordinalNum, timeAgo } from "../Util";
import AvatarImg from "../AvatarImg";

function Song() {
    const { song } = useParams();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await fetch(getHost() + '/api/network/top/song?song=' + song + "&strum=" + searchParams.get("strum"));
            if (!response.ok) {
                throw new Error('Song not found.');
            }
            const data = await response.json();
            console.log(data);
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
                        <h1>{prettySong[0]}</h1>
                        <p>Difficulty: {prettySong[1]}</p>
                        {searchParams.get("strum") == 1 ? <span>Opponent Side</span> : <></>}
                        {renderScores(song, data)}
                    </>
                )}
            </div>
        </div>
    )
}

function renderScores(song, scores) {
    var children = [];

    let i = 1;
    let leader = null; 
    for (const score of scores) {
        if (i === 1) {
            leader = score;
        }
        //const date = new Date(Date.parse(score.submitted));
        children.push(<tr key={score.submitted}>
            <td>
                {ordinalNum(i)}
            </td>
            <td>
                <a href={"/user/" + encodeURIComponent(score.player)}> {score.player} </a>
            </td>
            <td>
                {score.score}
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
        <a href={"/user/" + encodeURIComponent(leader.player)} className='LeaderContainer'>
            <AvatarImg src={getHost() + "/api/avatar/" + btoa(leader.player)}></AvatarImg>
            <div className="FlexBox">
                <br></br>
                <span className="BigText">1st</span><span className="BiggerText"> {leader.player} </span>
                <br></br><span>Score: {leader.score}</span>
                <span>{leader.points}FP</span>
                <br></br><span>Accuracy: {leader.accuracy}%</span>
                <br></br><span>{timeAgo.format(Date.parse(leader.submitted))}</span>
            </div>
        </a>
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

export default Song;