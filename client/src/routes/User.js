/* eslint-disable react-hooks/exhaustive-deps */
import { useParams } from 'react-router-dom';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import AvatarImg from '../AvatarImg';
import { allCountries, contentProfileColor, getHost, hasAccess, headProfileColor, moneyFormatter, ordinalNum, textProfileColor, textProfileRow, timeAgo } from '../Util';
import { Icon } from '@iconify/react';
import Editor from 'react-simple-wysiwyg';
import AvatarEditor from 'react-avatar-editor';
import Popup from 'reactjs-popup';

function ReturnDate(time) {
    const date = new Date(time);
    return date.getDate() + '/' + (date.getMonth() + 1) + "/" + (date.getFullYear() + "").substring(2);
}

function User() {
    let { name } = useParams();
    name = decodeURIComponent(name);

    const [data, setData] = useState({
        joined: 0,
        lastActive: 0,
        points: 0,
        isSelf: false,
        bio: '',
        friends: [],
        canFriend: false,
        profileHue: -1,
        avgAccuracy: 0,
        rank: -1,
        country: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editBioMode, setBioEditMode] = useState(null);
    const [bioHTML, setHTML] = useState(null);
    const [adminMode, setAdminMode] = useState(Cookies.get('admin') ?? undefined);

    document.documentElement.style.setProperty('--background-image', 'url("' + getHost() + "/api/background/" + encodeURIComponent(name) + '")');

    function onChange(e) {
        setHTML(e.target.value);
    }

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/user/details?name=' + name, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('User not found.');
            }

            document.documentElement.style.setProperty('--content-profile-color', contentProfileColor(data.profileHue, data.points));
            document.documentElement.style.setProperty('--text-profile-color', textProfileColor(data.profileHue));
            document.documentElement.style.setProperty('--row-profile-color', textProfileRow(data.profileHue));
            document.documentElement.style.setProperty('--row-profile-color-two', textProfileRow(data.profileHue, true));
            if (data.isSelf) {
                document.documentElement.style.setProperty('--head-profile-color', headProfileColor(data.profileHue));
            }

            setError(null);
            setData(response.data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    const toggleEditBio = async () => {
        if (editBioMode) {
            var countries = document.getElementById("country");
            var country = countries.options[countries.selectedIndex].value;

            try {
                const response = await axios.post(getHost() + '/api/account/profile/set', {
                    bio: bioHTML ?? data.bio,
                    hue: document.getElementById('ProfileColorSlider').value,
                    country: country
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

    const requestFriend = async () => {
        try {
            const response = await axios.get(getHost() + '/api/user/friends/' + (data.friends.includes(Cookies.get('username')) ? 'remove' : 'request') + '?name=' + name, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                alert(response.data);
                throw new Error('Failed.');
            }
        } catch (error) { }

        fetchData();
    }

    const removeImages = async () => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm('Are you sure?')) {
            return;
        }
        //pretty sure

        try {
            const response = await axios.get(getHost() + '/api/account/removeimages', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                alert(response.data);
                throw new Error('Failed.');
            }
        } catch (error) { }

        fetchData();
    }

    function onColorChange(e) {
        const color = e?.target?.value ?? data.profileHue;
        document.documentElement.style.setProperty('--content-profile-color', contentProfileColor(color, data.points));
        document.documentElement.style.setProperty('--text-profile-color', textProfileColor(color));
        document.documentElement.style.setProperty('--row-profile-color', textProfileRow(color));
        document.documentElement.style.setProperty('--row-profile-color-two', textProfileRow(color, true));
        if (data.isSelf) {
            document.documentElement.style.setProperty('--head-profile-color', headProfileColor(color));
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    useLayoutEffect(() => {
        try {
            onColorChange();
        } catch (exc) { }
    }, [data, setData, setLoading])

    function toggleAdmin() {
        if (Cookies.get('admin')) {
            Cookies.remove('admin');
            setAdminMode(undefined);
            return;
        }
        Cookies.set('admin', '1');
        setAdminMode('1');
    }

    function clickedAvatar(e) {
        if (data.isSelf) {
            document.getElementById('upload-avatar').click();
        }
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
                        {data.role === "Banned" ? (
                            <>
                            <span className='AvatarCaption'> <s> {name} </s> </span>
                            <center> <b> BANNED </b> </center>
                            </>
                        ) : <>
                            <div className='Over'>
                                {editBioMode ? 
                                    <div className='OverFloat' onClick={clickedAvatar}>
                                        <div className='WholeCenter'>
                                            <span> Upload Avatar </span>
                                        </div>
                                    </div>
                                : <></>}
                                <AvatarImg src={getHost() + "/api/avatar/" + encodeURIComponent(name)} />
                            </div>
                            <div className='NameContainer'>
                                <span className='AvatarCaption'> {name} </span>
                                {data.country ?
                                    <Flag code={data.country}></Flag>
                                : <></>}
                            </div>
                            {data.role ? (
                                <center> <b> {data.role} </b> </center>
                            ) : <></>}
                        </>}
                        <b>Rank: </b> {ordinalNum(data.rank)} <br />
                        <b>Points: </b> {moneyFormatter.format(data.points)} <br />
                        <b>Accuracy: </b> {(data.avgAccuracy * 100).toFixed(2)}% <br />
                        <b>Seen: </b> {timeAgo.format(Date.parse(data.lastActive))} <br />
                        <b>Joined: </b> {ReturnDate(Date.parse(data.joined))} <br />
                        {
                            data?.friends.length > 0 ?
                                <>
                                    <br></br>
                                    <center> <b>Friends</b> </center>
                                    <div className='FrenBox'>
                                        {renderFriends(data.friends)}
                                    </div>
                                </>
                            : <></>
                        }
                        <br></br>
                        {data.isSelf ?
                            <>
                                <button className='SvgButton' title={editBioMode ? "Save Profile" : "Profile Edit Mode"} onClick={toggleEditBio}>
                                    {editBioMode ? <Icon width={20} icon="material-symbols:save" /> : <Icon width={20} icon="mdi:paper-edit-outline" />}
                                </button>
                                {editBioMode ? <>
                                    <AvatarUpload id='avatarupload'></AvatarUpload>
                                    {
                                        data.points >= 1000 ? <BackgroundUpload id='backgroundupload'></BackgroundUpload> : <></>
                                    }
                                    <button className='SvgButton' title='Remove Images' onClick={removeImages}>
                                        {<Icon width={20} icon="mdi:image-remove" />}
                                    </button>
                                </> : <></>}
                            </>
                         : 
                            data.canFriend ? 
                                <button className='SvgButton' title={data.friends.includes(Cookies.get('username')) ? "Remove Friend" : "Add Friend"} onClick={requestFriend}>
                                    {data.friends.includes(Cookies.get('username')) ? <Icon width={20} icon="mdi:user-minus" /> : <Icon width={20} icon="mdi:user-add" />}
                                </button>
                            :
                            <></>
                        }
                        {hasAccess('/api/admin/user/ban') || hasAccess('/api/admin/score/delete') ?
                            <button className='SvgButton' title={adminMode ? "User Mode" : "Admin Mode"} onClick={toggleAdmin}>
                                {adminMode ? <Icon width={20} icon="mdi:user-box" /> : <Icon width={20} icon="eos-icons:admin" />}
                            </button>
                        : <></>}
                        {
                            adminMode && hasAccess('/api/admin/user/ban') ? 
                                <a title='Ban' target="_blank" rel='noreferrer' style={{ color: 'var(--text-profile-color)' }} href={"/api/admin/user/ban?username=" + name + "&to=" + (data.role === "Banned" ? "false" : "true")}>
                                    <button className='SvgButton'>
                                        {(data.role === "Banned" ? <Icon width={20} icon="mdi:hand-back-right" /> : <Icon width={20} icon="rivet-icons:ban" />)}
                                    </button>
                                </a>
                            : <></>
                        }
                        {
                            editBioMode ? 
                                <>
                                    <br></br>
                                    <br></br>
                                    BG Color:
                                    <input id='ProfileColorSlider' type="range" min="0" max="360" defaultValue={data.profileHue} onInput={onColorChange} />
                                    <br></br>
                                    Country:
                                    <br></br>
                                    <CountrySelect country={data.country}/>
                                </>
                            :
                                <></>
                        }
                    </div>
                    <div className='VerticalLine'> </div>
                    <div className='Contents'>
                        {editBioMode ? 
                            <>
                                <Editor id="BioEditor" value={bioHTML ?? data.bio} defaultValue={data.bio} onChange={onChange} />
                            </>
                        : 
                            <div className='UserBio' dangerouslySetInnerHTML={{ __html: data.bio }} />
                        }
                        <UserScores user={name} adminMode={adminMode}></UserScores>
                        <Popup trigger={<button id='openavatareditor' style={{display: 'none'}}></button>} modal>
                            <div className='Content'> 
                                <UserIconEditor/>
                            </div>
                        </Popup>
                    </div>
                </>
            )}
        </div>
    );
}

export function CountrySelect(props) {
    const countryOptions = [];
    allCountries.forEach((v, k) => {
        if (k === props.country) {
            countryOptions.push(<option value={k} selected>{v}</option>);
            return;
        }
        countryOptions.push(<option value={k}>{v}</option>);
    });

    return (<select id='country' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].value);
    } : undefined}> {countryOptions} </select>);
}

export function Flag(props) {
    return (
        <img className={props.className ?? 'SmallFlag'} src={"https://flagcdn.com/h24/" + props.code.toLowerCase() + ".png"} onError={(e) => {
            e.target.src = "https://flagsapi.com/" + props.code + "/flat/24.png";
        }} alt={props.code} title={allCountries.get(props.code)}/>
    );
}

let daUploadedAvatar = null;

function UserIconEditor() {
    let editor = null;

    const [zoom, setZoom] = useState(1);
    const [angle, setAngle] = useState(0);

    let jpegCompression = 0.9; // 90% should be semi-lossless quality, and should save more space

    function onClickPreview() {
        const canvas = editor.getImage()

        canvas.toBlob(
            (file) => {
                const fileURL = URL.createObjectURL(file);
                window.open(fileURL, '_blank').focus();

                // document.getElementById('avatarpreview').src = fileURL;
                // document.getElementById('avatarpreviewsize').textContent = (file.size * 0.001) + 'kB (' + (jpegCompression * 100) + "%)";
            },
            "image/jpeg",
            jpegCompression
        );
    }

    function onClickSave() {
        if (editor) {
            // This returns a HTMLCanvasElement, it can be made into a data URL or a blob,
            // drawn on another canvas, or added to the DOM.
            const canvas = editor.getImage()
            // If you want the image resized to the canvas size (also a HTMLCanvasElement)
            // const canvasScaled = editor.getImageScaledToCanvas()

            canvas.toBlob(
                (file) => {
                    if (file.size > 1024 * 100) {
                        alert("Compressed Image has exceeded 100kB!\n\nTry adjusting the compression value to make it lighter! (" + (file.size * 0.001) + "kB)");
                        return;
                    }
                    const formData = new FormData();
                    formData.append('file', file);
                    const config = {
                        headers: {
                            'content-type': 'multipart/form-data',
                            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken')),
                        },
                    };
                    axios.post(getHost() + '/api/account/avatar', formData, config).then((response) => {
                        if (response.status === 415) {
                            alert('Image should be a PNG type!');
                        }
                        window.location.reload();
                    }).catch(exc => {
                        document.body.innerHTML = exc;
                        console.error(exc);
                    });
                },
                "image/jpeg",
                jpegCompression
            );
        }
    }

    function avatarScrollEvent(e) {
        if (!e.shiftKey) {
            let daZoom = zoom - (e.deltaY / 500);
            if (daZoom < 1)
                daZoom = 1;
            if (daZoom > 5)
                daZoom = 5;
            setZoom(daZoom);
            document.getElementById('avatarzoom').value = daZoom * 100;
        }
        else {
            let daAngle = angle + (e.deltaY / 10);
            if (daAngle < 0)
                daAngle = 360;
            if (daAngle > 360)
                daAngle = 0;
            setAngle(daAngle);
            document.getElementById('avatarangle').value = daAngle;
        }
    }

    return (
        <div style={{display: 'inline'}}>
            <AvatarEditor
                ref={(refEditor) => editor = refEditor}
                image={daUploadedAvatar}
                width={250}
                height={250}
                border={50}
                color={[255, 255, 255, 0.6]} // RGBA
                scale={zoom}
                rotate={angle}
                onWheel={avatarScrollEvent}
            />
            <br/>
            Scale:
            <input id="avatarzoom" type="range" min="100" max="500" defaultValue={zoom * 100} onInput={(e) => setZoom(e.target.value / 100)} />
            <br />
            Angle:
            <input id="avatarangle" type="range" min="0" max="360" defaultValue={angle} onInput={(e) => setAngle(e.target.value)} />
            <br/>
            Compression:
            <input type="range" min="0" max="100" defaultValue={100 - (jpegCompression * 100)} onInput={(e) => jpegCompression = 1 - (e.target.value / 100)} />
            <br/>
            <center>
                <button onClick={onClickSave}> Save </button>
                <button onClick={onClickPreview}> Preview </button>
            </center>
            {/* <br />
            <img id='avatarpreview' alt='Preview'></img>
            <center>
                <p id='avatarpreviewsize'></p>
            </center> */}
        </div>
    );
}

function renderFriends(friends) {
    let children = [];

    for (const friend of friends) {
        children.push(
            <a key={friend} href={"/user/" + encodeURIComponent(friend)}>
                <AvatarImg className='FrenAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(friend)}></AvatarImg>
            </a>
        );
    }

    return children;
}

function UserScores(props) {
    const [data, setData] = useState([
        {
            name: "?",
            songId: "?",
            strum: 0,
            score: 0,
            accuracy: 0,
            points: 0,
            submitted: 0,
            id: '',
            modURL: ''
        }
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(getHost() + '/api/user/scores?name=' + props.user + "&page=" + page);
            if (response.status !== 200) {
                throw new Error('User not found.');
            }
            setPage(page);
            setData(response.data);
            setLoading(false);
            setError(null);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page]);

    if (loading)
        return (<p>Fetching Scores...</p>);

    if (error)
        return (<p>Error: {error}</p>);

    function renderScores(scores, isAdmin) {
        var children = [];

        let i = 0;
        for (const score of scores) {
            const songURL = "/song/" + score.songId + "?strum=" + score.strum;
            children.push(<tr key={score.submitted}>
                <td>
                    <a href={songURL}> {score.name} </a>
                    {
                        isAdmin && hasAccess('/api/admin/score/delete') ?
                            <>
                                <button title='Remove Score' className='SvgNoButton' style={{ float: 'right', color: 'var(--text-profile-color)' }} onClick={() => removeScore(score.id)}>
                                    <Icon width={20} icon="mdi:trash-outline" />
                                </button>
                            </>
                            : <></>
                    }
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
            </tr>);
            i++;
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

    async function removeScore(scoreId) {
        try {
            const response = await axios.get(getHost() + "/api/admin/score/delete?id=" + scoreId, {
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

    return (<>
        {data.length > 0 ? (
            <>
                <center> <b> Best Performances </b> </center>
                {renderScores(data, props.adminMode)}
                <br></br>
                {(page > 0) ?
                    <button className='SvgButton' style={{ float: 'left' }} onClick={() => {
                        setPage(page - 1);
                    }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                    : <></>}

                {(data.length === 15) ?
                    <button className='SvgButton' style={{ float: 'right' }} onClick={() => {
                        setPage(page + 1);
                    }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                    : <></>}
            </>
        ) :
            (page > 0) ? fetchData(0) : <></>
        }
    </>);
}

const AvatarUpload = () => {
    const actualBtnRef = useRef(null);

    const upload = (event) => {
        daUploadedAvatar = event.target.files[0];
        document.getElementById('openavatareditor').click();
    }

    return (
        <>
            <input accept="image/png, image/jpeg" type="file" id="upload-avatar" hidden ref={actualBtnRef} onChange={upload} />
            {/* <button className='SvgButton' title='Upload Avatar' onClick={() => {
                document.getElementById('upload-avatar').click();
            }}>
                <Icon width={20} icon="mdi:image-add" />
            </button> */}
        </>
    );
};

const BackgroundUpload = () => {
    const actualBtnRef = useRef(null);

    const upload = (event) => {
        const file = event.target.files[0];
        if (file.size > 1024 * 100) {
            alert("Compressed Image has exceeded 100kB!\n\nTry adjusting the compression value to make it lighter! (" + (file.size * 0.001) + "kB)");
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const config = {
            headers: {
                'content-type': 'multipart/form-data',
                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken')),
            },
        };
        axios.post(getHost() + '/api/account/background', formData, config).then((response) => {
            if (response.status === 415) {
                alert('Image should be a PNG type!');
            }
            if (response.status === 418) {
                alert('You must have 1000+ FP!');
            }
            window.location.reload();
        }).catch(exc => {
            document.body.innerHTML = exc;
            console.error(exc);
        });
    }

    return (
        <>
            <input accept="image/png, image/jpeg" type="file" id="upload-background" hidden ref={actualBtnRef} onChange={upload} />
            <button className='SvgButton' title='Upload Background (2145x1035)' onClick={() => {
                document.getElementById('upload-background').click();
            }}>
                <Icon width={20} icon="mdi:image-add" />
            </button>
        </>
    );
};

export default User;