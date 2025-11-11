/* eslint-disable react-hooks/exhaustive-deps */
import { useNavigate, useParams } from 'react-router-dom';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import AvatarImg from '../AvatarImg';
import { allCountries, borderColor, contentProfileColor, getHost, hasAccess, headProfileColor, miniProfileColor, moneyFormatter, ordinalNum, profileBackgroundColor, returnDate, tabButtonColor, textProfileColor, textProfileRow, timeAgo } from '../Util';
import { Icon } from '@iconify/react';
import Editor from 'react-simple-wysiwyg';
import AvatarEditor from 'react-avatar-editor';
import Popup from 'reactjs-popup';
import { TopCategorySelect, TopSortSelect } from '../components';

function User() {
    let { name } = useParams();
    name = decodeURIComponent(name);

    const navigate = useNavigate();

    const [data, setData] = useState({
        joined: 0,
        lastActive: 0,
        points: 0,
        isSelf: false,
        bio: '',
        friends: [],
        canFriend: false,
        profileHue: undefined,
        profileHue2: undefined,
        avgAccuracy: 0,
        rank: -1,
        country: '',
        club: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editBioMode, setBioEditMode] = useState(null);
    const [bioHTML, setHTML] = useState(null);
    const [adminMode, setAdminMode] = useState(Cookies.get('admin') ?? undefined);
    const [topCategory, setTopCategory] = useState(Cookies.get('user_topcategory'));
    const [topSort, setTopSort] = useState(Cookies.get('user_topsort'));

    document.documentElement.style.setProperty('--background-image', 'url("' + getHost() + "/api/user/background/" + encodeURIComponent(name) + '")');

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
                    hue2: document?.getElementById('ProfileColorSlider2')?.value,
                    country: country
                }, {
                    headers: {
                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                    }
                });
                if (response.status !== 200) {
                    throw new Error('Failed.');
                }
                window.alert('Changes Saved!');
            } catch (error) {
                console.error(error);
                window.alert(error);
            }
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

    function onColorChange(_) {
        const color = document?.getElementById('ProfileColorSlider')?.value ?? data.profileHue;
        const color2 = document?.getElementById('ProfileColorSlider2')?.value ?? data.profileHue2;

        if (data.profileHue === undefined)
            return;

        document.documentElement.style.setProperty('--content-profile-color', contentProfileColor(color, color2));
        document.documentElement.style.setProperty('--text-profile-color', textProfileColor(color));
        document.documentElement.style.setProperty('--row-profile-color', textProfileRow(color));
        document.documentElement.style.setProperty('--row-profile-color-two', textProfileRow(color, true));
        if (data.isSelf) {
            document.documentElement.style.setProperty('--head-profile-color', headProfileColor(color));
            document.documentElement.style.setProperty('--tab-button-color', tabButtonColor(color));
        }
        if (color2 !== undefined && color2 != null)
            document.documentElement.style.setProperty('--border-color', borderColor(color, color2));
        document.documentElement.style.setProperty('--background-color', profileBackgroundColor(color));
    }

    useEffect(() => {
        fetchData();
    }, []);

    useLayoutEffect(() => {
        onColorChange(null);
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
                modURL: '',
                misses: 0,
                pointsWeekly: 0,
            }
        ]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [page, setPage] = useState(0);

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(getHost() + '/api/user/scores?name=' + props.user + "&page=" + page + (topCategory ? '&category=' + topCategory : '') + (topSort ? '&sort=' + topSort : ''));
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
        }, [page, topCategory]);

        function renderScores(scores, isAdmin) {
            var children = [];

            let i = 0;
            for (const score of scores) {
                const songURL = "/song/" + score.songId + "?strum=" + score.strum + (topCategory ? '&category=' + topCategory : '');
                children.push(<tr key={score.submitted}>
                    <td>
                        <a href={songURL}> {score.name} <img alt={score.strum !== 2 ? ' (op)' : ' (bf)'} src={'/images/' + (score.strum !== 2 ? 'op' : 'bf') + '_icon.png'} style={{ maxHeight: '20px' }}></img> </a>
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
                    {topSort ? topSort.startsWith('submitted') ? <td>
                        {timeAgo.format(Date.parse(score.submitted))}
                    </td> : topSort.startsWith('misses') ? <>
                        {score.misses}
                    </> : <></> : <></>}
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
                            {topSort ? topSort.startsWith('submitted') ? <td>
                                Submitted
                            </td> : topSort.startsWith('misses') ? <>
                                Misses
                            </> : <></> : <></>}
                        </tr>
                        {children}
                    </tbody>
                </table>
            );
        }

        async function removeScore(scoreId) {
            if (!window.confirm('Are you sure?'))
                return;

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
            <h2> Performances </h2>
            {
                loading ? <center> Fetching Scores... </center> :
                error ? <center> Error: {error} </center> :
                data.length > 0 ? (
                <>
                    {renderScores(data, props.adminMode)}
                </>
            ) :
                (page > 0) ? fetchData(0) : <> <center> None. </center> </>
            }
            <br></br>
            <center> Time: <TopCategorySelect v={topCategory} onSelect={(sel) => {
                Cookies.set('user_topcategory', sel);
                if (!sel)
                    Cookies.remove('user_topcategory');
                setTopCategory(sel);
            }} />
            &nbsp;
            Sort By: <TopSortSelect v={topSort} onSelect={(sel) => {
                Cookies.set('user_topsort', sel);
                if (!sel)
                    Cookies.remove('user_topsort');
                setTopSort(sel);
            }} />
            </center>
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
        </>);
    }

    return (
        <div className='Content' id='ProfileContent'>
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
                                <AvatarImg src={getHost() + "/api/user/avatar/" + encodeURIComponent(name)} />
                            </div>
                            <div className='NameContainer'>
                                <span className='AvatarCaption'> {name} </span>
                                {data.country ?
                                    <a href={'/top/players?country=' + data.country}>
                                        <Flag code={data.country}></Flag>
                                    </a>
                                : <></>}
                            </div>
                            {data.club ? (
                                <>
                                <center> <a href={'/club/' + data.club} style={{color: 'white'}}> [{data.club}] </a> </center>
                                </>
                            ) : <></>}
                            {data.role ? (
                                <center> <b> {data.role} </b> </center>
                            ) : <></>}
                        </>}
                        <b>Rank: </b> {ordinalNum(data.rank)} <br />
                        <b>Points: </b> {moneyFormatter.format(topCategory === 'week' ? data.pointsWeekly : data.points)} <br />
                        <b>Accuracy: </b> {(data.avgAccuracy * 100).toFixed(2)}% <br />
                        <b>Seen: </b> {timeAgo.format(Date.parse(data.lastActive))} <br />
                        <b>Joined: </b> {returnDate(Date.parse(data.joined))} <br />
                        {
                            data?.friends.length > 0 ?
                                <>
                                    <br></br>
                                    <center> <b>Friends</b> </center>
                                    <div className='FrenBox'>
                                        <Friends data={data.friends}></Friends>
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
                                <a title='Ban' rel='noreferrer' style={{ color: 'var(--text-profile-color)' }} onClick={() => {
                                    if (!window.confirm('Are you sure?'))
                                        return;

                                    navigate("/api/admin/user/ban?username=" + name + "&to=" + (data.role === "Banned" ? "false" : "true"));
                                }} href='##'>
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
                                    { data.points >= 500 ? (
                                        <>
                                            BG Color 2:
                                             <input id='ProfileColorSlider2' type="range" min="0" max="360" defaultValue={data.profileHue2} onInput={onColorChange} />
                                        </>
                                    ) : <></>}
                                    <br></br>
                                    Country:
                                    <br></br>
                                    <CountrySelect country={data.country}/>
                                    <br></br>
                                    <br></br>
                                    <a className='TabButton' href="/login">LOGOUT</a>
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
                        {/* <br/>
                        <h2> Statistics </h2>
                        <h3> Total </h3>
                        <b>Points: </b> {data.points}FP <br />
                        <b>Average Accuracy: </b> {(data.avgAccuracy * 100).toFixed(2)}% <br />
                        <b>Note Hits: </b> 6400 000 000 <br />
                        <b>Score: </b> 600 000 <br />
                        <h3> Song Record by Highest Acc. </h3>
                        <b>FP: </b> 64FP <a href="/song/no">(DadBattle [Nightmare])</a> <br />
                        <b>Accuracy: </b> 99.9% <a href="/song/no">(DadBattle [Nightmare])</a> <br />
                        <b>Combo: </b> 6400 <a href="/song/no">(DadBattle [Nightmare])</a> <br />
                        <b>Score: </b> 6400 <a href="/song/no">(DadBattle [Nightmare])</a> <br />
                        <b>Misses: </b> 6400 <a href="/song/no">(DadBattle [Nightmare])</a> <br />
                        <h3> Rank <a href="a" className='SmallText' style={{color: 'var(--text-profile-color)', fontWeight: 'normal'}}> (Show for Poland) </a> </h3>
                        <b>FP Rank: </b> 9999nd <br />
                        <b>Avg. Accuracy Rank: </b> 9999nd <br />
                        <h2> Achievements </h2>
                        TBA ;) */}
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
    const [asPNG, setAsPNG] = useState(false);

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
            asPNG ? "image/png" : "image/jpeg",
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
                    uploadAvatarFile(file);
                },
                asPNG ? "image/png" : "image/jpeg",
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

    function onClickTransparent(e) {
        setAsPNG(!asPNG);
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
            {!asPNG ? <>
                Compression:
                <input type="range" min="0" max="100" defaultValue={100 - (jpegCompression * 100)} onInput={(e) => jpegCompression = 1 - (e.target.value / 100)} />
                <br />
            </> : <></>}
            <br/>
            Transparent (No Compression):
            <input id="aspng" type="checkbox" onInput={onClickTransparent} />
            <br/>
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

function uploadAvatarFile(file) {
    if (file.size > 1024 * 200) {
        alert("Compressed Image has exceeded 200kB!\n\nTry adjusting the compression value to make it lighter! (" + (file.size * 0.001) + "kB)");
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
            alert('Image should be a PNG/JPEG/GIF type!');
        }
        window.location.reload();
    }).catch(exc => {
        document.body.innerHTML = exc;
        console.error(exc);
    });
}

const Friends = (props) => {
    const [more, setMore] = useState(false);

    let children = [];
    let other = [];

    let pick = children;

    let i = 0;
    for (const friend of props.data) {
        if (!more && i > 34) {
            pick = other;
        }
        pick.push(
            <a key={friend} href={"/user/" + encodeURIComponent(friend)}>
                <AvatarImg className='FrenAvatar' title={friend} src={getHost() + "/api/user/avatar/" + encodeURIComponent(friend)}></AvatarImg>
            </a>
        );
        i++;
    }

    if (other.length === 1) {
        children.push(other.shift());
    }

    if (other.length > 1) {
        children.push(
            <a title="More" href={"#"} onClick={() => {
                setMore(true);
            }}>
                <div className='FrenAvatar' style={{
                    background: '#0000004d',
                    display: 'inline-block',
                    borderRadius: '30px',
                    alignContent: 'center',
                    overflow: 'hidden',
                }}>+</div>
            </a>
        );
    }

    return children;
}

const AvatarUpload = () => {
    const actualBtnRef = useRef(null);

    const upload = (event) => {
        daUploadedAvatar = event.target.files[0];
        if (daUploadedAvatar.type === "image/gif") {
            uploadAvatarFile(daUploadedAvatar);
        }
        else {
            document.getElementById('openavatareditor').click();
        }
    }

    return (
        <>
            <input accept="image/png, image/jpeg, image/gif" type="file" id="upload-avatar" hidden ref={actualBtnRef} onChange={upload} />
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
        if (file.size > 1024 * 1000) {
            alert("Compressed Image has exceeded 1MB!\n\nTry adjusting the compression value to make it lighter! (" + (file.size * 0.001) + "kB)");
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