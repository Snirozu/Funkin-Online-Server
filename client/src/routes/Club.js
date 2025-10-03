import { useEffect, useState } from "react";
import AvatarImg from "../AvatarImg";
import { clubProfileColor, contentProfileColor, getHost, hasAccess, headProfileColor, miniProfileColor, moneyFormatter, ordinalNum, returnDate } from "../Util";
import axios from "axios";
import Cookies from 'js-cookie';
import { useParams } from "react-router-dom";
import { Flag } from "./User";
import { Icon } from "@iconify/react/dist/iconify.js";
import Popup from "reactjs-popup";
import AvatarEditor from "react-avatar-editor";
import Editor, { EditorProvider } from 'react-simple-wysiwyg';

let daUploadedBanner;

function Club() {
    let { tag } = useParams();
    tag = decodeURIComponent(tag);

    const [data, setData] = useState({
        name: '',
        tag: '',
        members: [],
        leaders: [],
        content: '',
        created: 0,
        points: 0,
        rank: 0,
        hue: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [clanEditMode, setClanEditMode] = useState(false);
    const isMod = data.leaders.includes(Cookies.get('username'));
    let isMember = false;
    for (const member of data.members) {
        if (member.player === Cookies.get('username'))
            isMember = true;
    }

    const [htmlContent, setHTMLContent] = useState(data.content);
    const [clubName, setClubName] = useState(data.name);
    const [clubHue, setClubHue] = useState(data.hue);

    const [pending, setPending] = useState(null);
    const [pendingError, setPendingError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/club/details?tag=' + tag, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('Club not found.');
            }
            const data = response.data;
            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }

        try {
            const response = await axios.get(getHost() + '/api/club/pending', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('Club not found.');
            }
            const data = response.data;
            setPendingError(null);
            setPending(data);
        } catch (error) {
            setPendingError(error.message);
        }
    };
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    useEffect(() => {
        setHTMLContent(data.content);
        setClubName(data.name);
        setClubHue(data.hue);
    }, [data])

    useEffect(() => {
        document.documentElement.style.setProperty('--content-profile-color', clubProfileColor(clubHue)); 
    }, [clubHue])

    async function toggleEditMode() {
        setClanEditMode(!clanEditMode);
        if (clanEditMode) {
            try {
                const response = await axios.post(getHost() + '/api/club/edit', {
                    content: htmlContent,
                    name: clubName,
                    hue: Number(clubHue)
                }, {
                    headers: {
                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                    }
                });
                if (response.status !== 200) {
                    throw new Error('Failed.');
                }
                // window.location.reload();
            } catch (error) {
                console.error(error);
                window.alert(error);
            }
        }
    }

    const setBanner = async (event) => {
        daUploadedBanner = event.target.files[0];
        if (daUploadedBanner.type === "image/gif") {
            uploadBanner(daUploadedBanner);
        }
        else {
            document.getElementById('openbannereditor').click();
        }
    }

    function renderPlayers(data) {
        let daPlayers = [];

        for (const player of data.members) {
            const isLeader = data.leaders.indexOf(player.player) !== -1;
            // const daRank = daPlayers.length + 1;
            daPlayers.push(
                <div className="FlexBox">
                    <a href={"/user/" + encodeURIComponent(player.player)} className='TopContainer' style={{ background: headProfileColor(player.profileHue, player.profileHue2) }}>
                        <AvatarImg className='TopAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(player.player)}></AvatarImg>
                        <div className="FlexBox">
                            {/* <span style={{fontSize: '20px', color: (
                            daRank === 1 ? 'orange' :
                            daRank === 2 ? 'darksalmon' : 
                            daRank === 3 ? 'lightsteelblue' : 
                            'darkgray' 
                        )}}>{ordinalNum(daRank)}</span> */}
                            <span style={{ fontSize: '35px' }}> {player.player} </span>
                            {player.country ?
                                <Flag className='BiggerFlag' code={player.country}></Flag>
                                : <></>}
                            {
                                isLeader ? (
                                    <> (Leader) </>
                                ) : (<></>)
                            }
                            <br></br>
                            <span style={{ fontSize: '20px', color: 'gainsboro' }}> {moneyFormatter.format(player.points)} FP </span>
                        </div>
                    </a>
                    {
                        clanEditMode ? <>
                            {
                                isLeader ? 
                                    <button onClick={async () => {
                                        if (!window.confirm('Are you sure?'))
                                            return;

                                        const response = await axios.get(getHost() + '/api/club/demote?user=' + player.player, {
                                            headers: {
                                                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                            }, validateStatus: () => true
                                        });

                                        if (response.status === 200) {
                                            window.location.reload();
                                        }
                                        else {
                                            alert(response.data);
                                        }
                                    }}> Demote {player.player} </button>
                                : 
                                    <button onClick={async () => {
                                        if (!window.confirm('Are you sure?'))
                                            return;

                                        const response = await axios.get(getHost() + '/api/club/promote?user=' + player.player, {
                                            headers: {
                                                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                            }, validateStatus: () => true
                                        });

                                        if (response.status === 200) {
                                            window.location.reload();
                                        }
                                        else {
                                            alert(response.data);
                                        }
                                    }}> Promote {player.player} </button>
                            }
                            &nbsp;
                            <button onClick={async () => {
                                if (!window.confirm('Are you sure?'))
                                    return;

                                const response = await axios.get(getHost() + '/api/club/kick?user=' + player.player, {
                                    headers: {
                                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                    }, validateStatus: () => true
                                });

                                if (response.status === 200) {
                                    window.location.reload();
                                }
                                else {
                                    alert(response.data);
                                }
                            }}> Kick {player.player} </button>
                        </> : <></>
                    }
                </div>
            );
        }

        if (daPlayers.length === 0) {
            daPlayers.push(<>
                <p> (None) </p>
            </>)
        }

        return daPlayers;
    }

    function renderPending(pending) {
        let daPlayers = [];

        for (const player of pending) {
            // const daRank = daPlayers.length + 1;
            daPlayers.push(
                <div className="FlexBox">
                    <a href={"/user/" + encodeURIComponent(player)} className='TopContainer' style={{}}>
                        <AvatarImg className='TopAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(player)}></AvatarImg>
                        <div className="FlexBox">
                            {/* <span style={{fontSize: '20px', color: (
                            daRank === 1 ? 'orange' :
                            daRank === 2 ? 'darksalmon' : 
                            daRank === 3 ? 'lightsteelblue' : 
                            'darkgray' 
                        )}}>{ordinalNum(daRank)}</span> */}
                            <span style={{ fontSize: '35px' }}> {player} </span>
                        </div>
                    </a>
                    <button onClick={async () => {
                        if (!window.confirm('Are you sure?'))
                            return;

                        const response = await axios.get(getHost() + '/api/club/accept?user=' + player, {
                            headers: {
                                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                            }, validateStatus: () => true
                        });

                        if (response.status === 200) {
                            window.location.reload();
                        }
                        else {
                            alert(response.data);
                        }
                    }}> Accept {player} </button>
                </div>
            );
        }

        if (daPlayers.length === 0) {
            daPlayers.push(<>
                <p> (None) </p>
            </>)
        }

        return daPlayers;
    }

    return <>
        <div className='Content'>
            <div className='Contents'> 
                {loading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p>Error: {error}</p>
                ) : (
                    <>
                        <div className="CenterFlex">
                            <img src={getHost() + "/api/club/banner/" + data.tag} alt=''></img>
                        </div>
                        {clanEditMode ? <>
                            <div className="CenterFlex">
                                <b>Upload Banner (256x128px)</b>
                            </div>
                            <div className="CenterFlex">
                                <input accept="image/png, image/jpeg, image/gif" type="file" onChange={setBanner} />
                            </div>
                        </> : <></>}
                        <div className="CenterFlex">
                            <h1 className="davefont">
                            {clanEditMode ? <>
                                <input className="SeamlessInput" value={clubName} onChange={e => {
                                    setClubName(e.target.value);
                                }}></input>
                            </> : <>
                                {clubName} 
                            </>}
                            &nbsp;[{data.tag}]</h1>
                        </div>
                        <div className="CenterFlex">
                            <b>Rank: </b> &nbsp; {ordinalNum(data.rank)} <br />
                        </div>
                        <div className="CenterFlex">
                            <b>Points: </b> &nbsp; {data.points}FP <br />
                        </div>
                        <div className="CenterFlex">
                            <b>Created: </b> &nbsp; {returnDate(Date.parse(data.created))} <br />
                        </div>
                        <br></br>
                        {clanEditMode ?
                            <EditorProvider>
                                <Editor id="BioEditor" value={htmlContent} defaultValue={htmlContent} onChange={e => {
                                    setHTMLContent(e.target.value);
                                }} />
                            </EditorProvider>
                            :
                            <div className='UserBio' dangerouslySetInnerHTML={{ __html: htmlContent }} />
                        }
                        <br></br>
                        <hr></hr>
                        <h2> Members </h2>
                        {renderPlayers(data)}
                        {clanEditMode ? <>
                            <br></br>
                            <hr></hr>
                            <h2> Pending </h2>
                            {pendingError ? <>
                                {pendingError}
                            </> : !pending ? <>
                                Loading...
                            </> : <>
                                {renderPending(pending)}
                            </>}
                            <br></br>
                            <hr></hr>
                            Accent:
                            <input id='ProfileColorSlider' type="range" min="0" max="360" value={clubHue} onChange={e => {
                                setClubHue(e.target.value);
                            }}/>
                            <br></br>
                        </> : <></>}
                        <br></br>
                        {
                            isMod ? <>
                                <button className='SvgButton' title={clanEditMode ? "Save Changes" : "Edit Mode"} onClick={toggleEditMode}>
                                    {clanEditMode ? <Icon width={20} icon="material-symbols:save" /> : <Icon width={20} icon="mdi:paper-edit-outline" />}
                                </button>
                            </> : <></>
                        }
                        {
                            isMember ? <>
                                <button className='SvgButton' title={"Leave Club"} onClick={async () => {
                                    if (!window.confirm('Are you sure?'))
                                        return;

                                    const response = await axios.get(getHost() + '/api/club/leave', {
                                        headers: {
                                            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                        }, validateStatus: () => true
                                    });

                                    if (response.status === 200) {
                                        window.location.reload();
                                    }
                                    else {
                                        alert(response.data);
                                    }
                                }}>
                                    <Icon width={20} icon="iconamoon:exit" />
                                </button>
                            </> : <>
                                <button onClick={async () => {
                                    if (!window.confirm('Are you sure?'))
                                        return;

                                    const response = await axios.get(getHost() + '/api/club/join?tag=' + data.tag, {
                                        headers: {
                                            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                        }, validateStatus: () => true
                                    });

                                    if (response.status === 200) {
                                        alert('Join Request Sent!');
                                        window.location.reload();
                                    }
                                    else {
                                        alert(response.data);
                                    }
                                }}> Request Join Club </button>
                            </>
                        }
                        {
                            hasAccess('/api/admin/club/delete') ? <>
                                <button className='SvgButton' title={"Remove Club"} onClick={async () => {
                                    if (!window.confirm('Are you sure?'))
                                        return;

                                    const response = await axios.get(getHost() + '/api/admin/club/delete?tag=' + data.tag, {
                                        headers: {
                                            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                        }, validateStatus: () => true
                                    });

                                    if (response.status === 200) {
                                        window.location.reload();
                                    }
                                    else {
                                        alert(response.data);
                                    }
                                }}>
                                    <Icon width={20} icon="rivet-icons:ban" />
                                </button>
                            </> : <></>
                        }
                        <Popup trigger={<button id='openbannereditor' style={{display: 'none'}}></button>} modal>
                            <div className='Content'> 
                                <BannerEditor/>
                            </div>
                        </Popup>
                    </>
                )}
            </div>
        </div>
    </>;
}

function BannerEditor() {
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
            // If you want the image resized to the canvas size (also a HTMLCanvasElement)
            const canvasScaled = editor.getImageScaledToCanvas()

            canvasScaled.toBlob(
                async (file) => {
                    await uploadBanner(file);
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
                image={daUploadedBanner}
                width={256}
                height={128}
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

async function uploadBanner(file) {
    if (file.size > 1024 * 300) {
        alert("Compressed Image has exceeded 350kb! (" + (file.size * 0.001) + "kB)");
        return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await axios.post(getHost() + '/api/club/banner', formData, {
            headers: {
                'content-type': 'multipart/form-data',
                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken')),
            },
            responseType: 'json', transformResponse: (body) => {
                try { return JSON.parse(body) } catch (exc) { return null; }
            }, validateStatus: () => true
        });

        if (response.status === 200) {
            alert('Banner Uploaded!');
            window.location.reload();
        }
        else {
            alert(response.data.error);
        }
    } catch (error) {
        alert(error.message);
    }
}


export default Club;