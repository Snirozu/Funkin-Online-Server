/* eslint-disable react-hooks/exhaustive-deps */
import { useParams, useSearchParams } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import AvatarImg from '../AvatarImg';
import { getHost, timeAgo } from '../Util';
import { Icon } from '@iconify/react';

function ReturnDate(time) {
    const date = new Date(time);
    return date.getDate() + '/' + (date.getMonth() + 1) + "/" + (date.getFullYear() + "").substring(2);
}

function User() {
    let { name } = useParams();
    name = decodeURIComponent(name);

    const [data, setData] = useState({
        isMod: false,
        joined: 0,
        lastActive: 0,
        points: 0,
        isSelf: false,
        isBanned: false,
        bio: '',
        scores: [
            {
                name: "?",
                songId: "?",
                strum: 0,
                score: 0,
                accuracy: 0,
                points: 0,
                submitted: 0,
                id: ''
            }
        ]
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editBioMode, setBioEditMode] = useState(null);
    const [queryParams] = useSearchParams();

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/network/user/details?name=' + name, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('User not found.');
            }
            setData(response.data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);

    const toggleEditBio = async () => {
        if (editBioMode) {
            try {
                const response = await axios.post(getHost() + '/api/network/account/bio/set', {
                    content: document.getElementById('bioInput').value
                }, {
                    headers: {
                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                    }
                });
                if (response.status !== 200) {
                    throw new Error('Failed.');
                }
            } catch (error) {}
        }

        setBioEditMode(!editBioMode);
        fetchData();
    }

    async function removeScore(scoreId) {
        try {
            const response = await axios.get(getHost() + "/api/network/admin/score/delete?id=" + scoreId, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('Failed.');
            }
        } catch (error) { }

        fetchData();
    }

    function renderScores(scores, isAdmin) {
        var children = [];

        for (const score of scores) {
            const songURL = "/song/" + score.songId + "?strum=" + score.strum;
            children.push(<tr key={score.submitted}>
                <td>
                    <a href={songURL}> {score.name} </a>
                    {
                        isAdmin ?
                            <>
                                <button title='Remove Score' className='SvgNoButton' style={{ float: 'right', color: 'red' }} onClick={() => removeScore(score.id)}>
                                    <Icon width={20} icon="mdi:trash-outline" />
                                </button>
                                <a title='View Replay' target="_blank" rel='noreferrer' style={{ float: 'right', color: 'red' }} href={"/api/network/score/replay?id=" + score.id}>
                                    <Icon width={20} icon="mdi:eye" />
                                </a>
                            </>
                        : <></>
                    }
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
            </tr>);
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <td> Song </td>
                        <td> Score </td>
                        <td> Accuracy </td>
                        <td> FP </td>
                    </tr>
                    {children}
                </tbody>
            </table>
        );
    }

    return (
        <div className='Content'>
            {loading ? (
                <p>Loading...</p>
            ) : error ? (
                <p>Error: {error}</p>
            ) : (
                <>
                    <div className='Sidebar'>
                        {data.isBanned ? (
                            <>
                            <span className='AvatarCaption'> <s> {name} </s> </span>
                            <center> <b> BANNED </b> </center>
                            </>
                        ) : <>
                            <AvatarImg src={getHost() + "/api/avatar/" + btoa(name)} />
                            <span className='AvatarCaption'> {name} </span>
                            {data.isMod ? (
                                <center> <b> Moderator </b> </center>
                            ) : <></>}
                        </>}
                        <b>Points: </b> {data.points} <br />
                        <b>Seen: </b> {timeAgo.format(Date.parse(data.lastActive))} <br />
                        <b>Joined: </b> {ReturnDate(Date.parse(data.joined))} <br />
                        <br></br>
                        {data.isSelf ?
                            <>
                                <AvatarUpload></AvatarUpload>
                                <button className='SvgButton' title={editBioMode ? "Save Bio" : "Bio Edit Mode"} onClick={toggleEditBio}>
                                    {editBioMode ? <Icon width={20} icon="material-symbols:save" /> : <Icon width={20} icon="mdi:paper-edit-outline" />}
                                </button>
                            </>
                         : <></>}
                        {Cookies.get('modmode') ?
                            <a href={queryParams.get('admin') ? "?" : "?admin=1"} title={queryParams.get('admin') ? "User Mode" : "Admin Mode"}>
                                <button className='SvgButton'>
                                    {queryParams.get('admin') ? <Icon width={20} icon="mdi:user-box" /> : <Icon width={20} icon="eos-icons:admin" />}
                                </button>
                            </a>
                        : <></>}
                        {
                            queryParams.get('admin') ? 
                                <a title='Ban' target="_blank" rel='noreferrer' style={{ color: 'red' }} href={"/api/network/admin/user/ban?username=" + name + "&to=" + (data.isBanned ? "false" : "true")}>
                                    <button className='SvgButton'>
                                        {(data.isBanned ? <Icon width={20} icon="mdi:hand-back-right" /> : <Icon width={20} icon="rivet-icons:ban" />)}
                                    </button>
                                </a>
                            : <></>
                        }
                    </div>
                    <div className='VerticalLine'> </div>
                    <div className='Contents'>
                        {editBioMode ? 
                            <>
                                <textarea rows="10" cols="85" id="bioInput" placeholder={"Hello World! <br>\n:)"}>
                                    {data.bio}
                                </textarea>
                            </>
                        : 
                            <div className='UserBio' dangerouslySetInnerHTML={{ __html: data.bio }} />
                        }
                        {data.scores.length > 0 ? (
                            <center> <b> Top Scores </b> </center>
                        ) : <></>}
                        {
                            renderScores(data.scores, queryParams.get('admin'))
                        }
                    </div>
                </>
            )}
        </div>
    );
}

const AvatarUpload = () => {
    const actualBtnRef = useRef(null);

    const upload = (event) => {
        const file = event.target.files[0];
        if (file.size > 512 * 1024) {
            alert("Image cannot exceed 512kB!");
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        console.log(Cookies.get('authid'));
        console.log(file);
        const config = {
            headers: {
                'content-type': 'multipart/form-data',
                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken')),
            },
        };
        axios.post(getHost() + '/api/network/account/avatar', formData, config).then((response) => {
            console.log(response.data);
            window.location.reload();
        }).catch(exc => {
            document.body.innerHTML = exc;
            console.error(exc);
        });
    }

    return (
        <>
            <input accept="image/*" type="file" id="upload-avatar" hidden ref={actualBtnRef} onChange={upload} />
            <button className='SvgButton' title='Upload Avatar' onClick={() => {
                document.getElementById('upload-avatar').click();
            }}>
                <Icon width={20} icon="mdi:image-add" />
            </button>
        </>
    );
};

export default User;