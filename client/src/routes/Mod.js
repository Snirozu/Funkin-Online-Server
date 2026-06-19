import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doRequestAndAlert, getHost, hasAccess, timeAgo } from "../Util";
import Cookies from 'js-cookie';
import { Icon } from "@iconify/react/dist/iconify.js";
import Popup from "reactjs-popup";
import { renderPlayers } from "./Network";

function Mod() {
    let { id } = useParams();
    id = decodeURIComponent(id);

    const navigate = useNavigate();

    const [data, setData] = useState({
        id: '',
        images: [],
        keywords: [],
        submitted: '',
        favorited: [],
        title: '',
        description: '',
        downloads: [],
        downloadsHits: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false);

    async function toggleEditMode() {
        if (editMode) {
            try {
                const response = await axios.post(getHost() + '/api/mod/edit', data, {
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

        setEditMode(!editMode);
        fetchData();
    }

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/mod/details/' + id, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }, responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return body; }
                }, validateStatus: () => true,
            });
            if (response.status !== 200) {
                throw new Error(typeof response.data == "object" ? response.data.error : response.data);
            }

            setError(null);
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

    function ModFavoriters(props) {
        return (
            <div className='Content'>
                <div className="Main">
                    <p> Mod Likers! </p>
                    <div className="CenteredFlex">
                        {renderPlayers(props.data.favorited)}
                    </div>

                    {
                        hasAccess('/api/mod/fav') ? <>
                            <br></br>
                            <button className='FunkinButton' onClick={async event => {
                                event.target.style.display = 'none';
                                await doRequestAndAlert('POST', '/api/mod/fav', {
                                    id: props.data.id,
                                })
                                fetchData();
                            }} style={{
                                fontFamily: 'PhantomMuff',
                                fontSize: '15px',
                                // color: '#ffa8c2',
                                padding: '10px'
                            }}> 
                                {props.data.favorited.includes(Cookies.get('username')) ? 'Remove from Liked' : 'Like this Mod!'}
                            </button>
                        </> : <></>
                    }
                </div>
            </div>
        );
    }

    const imgs = [];
    for (const image of data.images) {
        imgs.push(<img src={image} />);
    }

    const downloads = [];
    const rawDownloads = [];
    for (const download of data.downloads) {
        const downloadName = download.id.substring(data.id.length + 1);
        const downloadTitle = downloadName.toUpperCase();
        downloads.push(<>
            <a className="ModDownloadButton" style={{
                color: '#f290ff',
                minWidth: '100px'
            }} href={getHost() + "/mod/" + data.id + "/dl/" + downloadName} >
                <img width={'20px'} src="/favicon.ico"></img>
                <span> {downloadTitle} </span>
                {download.size > 0 ? <>
                    <span className="SmallText"> 
                        {(Number(download.size) / 1024 / 1024).toFixed(2) + ' MB'} 
                    </span>
                    <span className="SmallText"> 
                        {download.hits} Downloads
                    </span>
                </> : <></>}
            </a>

            {
                editMode && hasAccess('/api/mod/dl/edit') ? <>
                    <Popup trigger={<button className='SvgButton' title={'Edit Mod Download'}> <Icon width={20} icon="mdi:paper-edit-outline" /> </button>} modal>
                        <EditDownload data={download}></EditDownload>
                    </Popup>
                </> : <></>
            }

            {
                editMode && hasAccess('/api/mod/dl/delete') ? <>
                    <button className='SvgButton' title={'Delete Mod Download'}> <Icon width={20} icon="mdi:trash-outline" onClick={async () => {
                        if (!window.confirm('Are you sure?'))
                            return;
                        
                        if (await doRequestAndAlert('POST', '/api/mod/dl/delete', {
                            id: download.id,
                        }))
                            alert('Download deleted! (Page refresh needed)')
                    }} /> </button>
                </> : <></>
            }
        </>);

        const rawLinks = [];
        for (const url of download.urls) {
            let dlInfo = getDlInfo(url.substr('https://'.length).split('/')[0]);
            
            function getDlInfo(domain) {
                if (domain.endsWith('mediafire.com')) {
                    return ['MediaFire', 'aqua', 'https://www.mediafire.com/favicon.ico'];
                }
                if (domain == 'drive.google.com') {
                    return ['Google Drive', 'lime', 'https://drive.google.com/favicon.ico'];
                }
                if (domain.endsWith('gamebanana.com')) {
                    return ['GameBanana', 'yellow', 'https://images.gamebanana.com/static/img/favicon/favicon.ico'];
                }
                return [domain, 'white', ''];
            }
            
            rawLinks.push((<a className="ModDownloadButton" style={{
                color: dlInfo[1],
                width: 'auto'
            }} href={url}>
                {dlInfo[2] ? <img src={dlInfo[2]}></img> : <></>}
                <span> {dlInfo[0]} </span>
            </a>));
        }

        rawDownloads.push(<>
            <span style={{
                fontSize: '18px'
            }}> {downloadName} </span>
            <div className="ModGenericFlex">
                {rawLinks}
            </div>
        </>);
    }
    if (downloads.length <= 0) {
        downloads.push(<>
            <span className="SmallText"> (Downloads Unavailable) </span>
        </>)
    }

    return loading ? (
        <div className="CenteredFlex">
            <p>Loading...</p>
        </div>
    ) : error ? (
        <div className="CenteredFlex">
            <p>Error: {error}</p>
        </div>
    ) : (
        <>
            <div className="CenteredFlex">
                <div className="RoundedContents">
                    <div className="ModContent" style={{
                        backgroundImage: 'url(' + data.images[0] + ')'
                    }}>
                        <div className="ModGenericFlex" style={{
                            backdropFilter: 'blur(10px) brightness(50%)',
                            width: '100%',
                            height: '45%',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <h1 style={{
                                fontFamily: 'PhantomMuff',
                                fontSize: '40px'
                            }}>
                                {editMode ? <>
                                    <input className="SeamlessInput" defaultValue={data.title} onChange={e => {
                                        data.title = e.target.value;
                                        setData(data);
                                    }}></input>
                                </> : <>
                                    {data.title}
                                </>}
                            </h1>
                        </div>

                        <div className="ModGenericFlex" style={{
                            height: '15%',
                            backdropFilter: 'blur(20px) brightness(20%)',
                            justifyContent: 'space-around',
                            alignItems: 'center',
                        }}>
                            <Popup trigger={
                                <p className="Hoverable"> {data.favorited.length} Likes </p>
                            } modal>
                                    <ModFavoriters data={data}></ModFavoriters>
                            </Popup>
                            <p> {data.downloadsHits} Downloads </p>
                        </div>

                        <div className="ModGallery">
                            {editMode ? <>
                                <textarea style={{ width: "100%", fontSize: '12px'}} className="SeamlessInput" defaultValue={data.images.join('\n')} onChange={e => {
                                    data.images = e.target.value.trim().split('\n');
                                    setData(data);
                                }}></textarea>
                            </> : <>
                                {imgs}
                            </>}
                        </div>
                    </div>

                    <div className="Item" style={{
                        backgroundColor: '#000000c0'
                    }}>
                        <p style={{whiteSpace: 'preserve-breaks'}}> {editMode ? <>
                                <textarea style={{ width: "100%", height: '200px'}} className="SeamlessInput" defaultValue={data.description} onChange={e => {
                                    data.description = e.target.value;
                                    setData(data);
                                }}></textarea>
                            </> : <>
                                {data.description}
                            </>} </p>

                        <hr style={{ lineHeight: '3.5' }}></hr>

                        <p> Downloads <span className="SmallText"> (Dynamic Download Link) </span> </p>

                        <div className="ModGenericFlex">
                        {downloads}
                        </div>

                        <br></br>
                        {rawDownloads.length > 0 ? <>
                            <details>
                            <summary> Raw Downloads </summary>
                            {rawDownloads}
                            </details>
                        </> : <></>}

                        {
                            editMode && hasAccess('/api/mod/dl/submit') ? <>
                                <Popup trigger={<button className='SvgButton' title={'Add Mod Download'}> <Icon width={20} icon="material-symbols:add-box-outline" /> </button>} modal>
                                    <AddDownload mod={id}></AddDownload>
                                </Popup>
                            </> : <></>
                        }

                        <p> Keywords </p>

                        {editMode ? <>
                            <textarea style={{ width: "100%", fontSize: '14px'}} className="SeamlessInput" defaultValue={data.keywords.join(' ')} onChange={e => {
                                data.keywords = e.target.value.trim().split(' ');
                                setData(data);
                            }}></textarea>
                        </> : <>
                            <div className="ModGenericFlex" style={{
                                fontSize: '14px',
                                color: '#ffffffcb'
                            }}>
                                <Keywords keywords={data.keywords} onClick={keyword => {
                                    navigate('/mods?q=' + keyword);
                                }}></Keywords>
                            </div>
                        </>}

                        <br></br>
                        {/* forced regular date format so it never changes to unreadable american format */}
                        <span className="SmallText"> Submitted: {new Date(data.submitted).toLocaleString("en-GB")}</span>
                        <br></br>

                        <br></br>
                        {
                            hasAccess('/api/mod/edit') ? <>
                                <button className='SvgButton' title={editMode ? "Save Changes" : "Edit Mode"} onClick={toggleEditMode}>
                                    {editMode ? <Icon width={20} icon="material-symbols:save" /> : <Icon width={20} icon="mdi:paper-edit-outline" />}
                                </button>
                            </> : <></>
                        }
                        {
                            editMode && hasAccess('/api/mod/delete') ? <>
                                <button className='SvgButton' title={'Delete Mod'}> <Icon width={20} icon="mdi:trash-outline" onClick={async () => {
                                    if (!window.confirm('THIS WILL DELETE THE MOD PERMAMENTLY'))
                                        return;
                                    
                                    if (await doRequestAndAlert('POST', '/api/mod/delete', {
                                        id: data.id,
                                    })) {
                                        alert('Mod deleted!')
                                        window.location.reload();
                                    }
                                }} /> </button>
                            </> : <></>
                        }
                    </div>
                </div>
            </div>
        </>
    )
}

function AddDownload(props) {
    const modId = props.mod;

    const [id, _setID] = useState('');
    function setID(v) {
        v = String(v).toLowerCase().replaceAll(' ', '_').trim();
        _setID(v);
    }
    const [urls, setURLs] = useState('');

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    async function submitData() {
        setLoading(true);

        try {
            if (!window.confirm('The ID cannot be changed after download submission.\nDo you want to proceed?'))
                return;

            const response = await axios.post(getHost() + '/api/mod/dl/submit', {
                id: id.trim(),
                urls: urls.trim().split('\n'),
                mod_id: modId,
            }, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                },
                responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return body; }
                }, validateStatus: () => true
            });

            if (response.status !== 200) {
                throw new Error(typeof response.data == "object" ? response.data.error : response.data);
            }

            setSubmitted(true);
        } 
        catch (error) {
            alert(error.message)
        }

        setLoading(false);
    }

    if (submitted) {
         return (
            <div className='Content'>
                <div className="Main">
                    Download submitted successfully! <br></br> 
                    (Refresh the page to view.)
                </div>
            </div>
         )
    }

    return (
        <div className='Content'>
            <div className="Main">
            <p> Submit a new download </p>
            <b> ID: </b> <input type="text" onChange={e => setID(e.target.value)} value={id.toUpperCase()} /> <br></br>
            The URL will look like: <br></br>
            https://funkin.sniro.boo/dl/<b>{modId + ':' + encodeURIComponent(id)}</b> <br></br>
            
            <b style={{ color: 'red' }}> THE ID CANNOT BE CHANGED </b>

            <br></br>
            <br></br>

            <b> URLs: </b>
            <br></br>
            (Input Download URLs here, separate by a new line) <br></br>
            <textarea style={{ width: "500px", height: "100px", fontSize: '12px'}} className="SeamlessInput" value={urls} onChange={e => {
                setURLs(e.target.value);
            }}></textarea>
            <br></br>
            {
                loading ? <>
                    Loading...
                </> : <>
                    <button className="FunkinButton" onClick={e => {
                        submitData();
                    }}> Create </button>
                </>
            }
            </div>
        </div>
    )
}

function EditDownload(props) {
    const data = props.data;
    const [urls, setURLs] = useState(data.urls.join('\n'));

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    async function submitData() {
        setLoading(true);

        try {
            const response = await axios.post(getHost() + '/api/mod/dl/edit', {
                id: data.id,
                urls: urls.trim().split('\n')
            }, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                },
                responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return body; }
                }, validateStatus: () => true
            });

            if (response.status !== 200) {
                throw new Error(typeof response.data == "object" ? response.data.error : response.data);
            }

            setSubmitted(true);
        } 
        catch (error) {
            alert(error.message)
        }

        setLoading(false);
    }

    if (submitted) {
         return (
            <div className='Content'>
                <div className="Main">
                    Links submitted successfully! <br></br> 
                    (Refresh the page to view.)
                </div>
            </div>
         )
    }

    return (
        <div className='Content'>
            <div className="Main">
            <b> URLs: </b>
            <br></br>
            (Input Download URLs here, separate by a new line) <br></br>
            <textarea style={{ width: "500px", height: "100px", fontSize: '12px'}} className="SeamlessInput" value={urls} onChange={e => {
                setURLs(e.target.value);
            }}></textarea>
            <br></br>
            {
                loading ? <>
                    Loading...
                </> : <>
                    <button className="FunkinButton" onClick={e => {
                        submitData();
                    }}> Save </button>
                </>
            }
            </div>
        </div>
    )
}

export function Keywords(props) {
    const originLength = props.keywords.length;
    const list = props.keywords.slice(0, props.take ?? props.keywords.length);

    const keywords = [];
    for (const keyword of list) {
        keywords.push(<div className={props.onClick ? "Hoverable" : ''} onClick={() => {
            props.onClick(keyword);
        }} style={{
            backgroundColor: '#ffffff27',
            padding: '8px',
            borderRadius: '20px'
        }}>
            {keyword}
        </div>);
    }

    if (originLength > props.take) {
        keywords.push(<div style={{
            backgroundColor: '#ffffff27',
            padding: '8px',
            borderRadius: '20px'
        }}>
            {'+' + (originLength - props.take)}
        </div>);
    }

    return keywords;
}

export default Mod;