import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHost, getResError } from "../Util";
import AvatarImg from "../AvatarImg";
import { Keywords } from "./Mod";

function Search() {
    const [searchParams] = useSearchParams();
    const [input, setInput] = useState('');
    const navigate = useNavigate();

    function onKeyPressHandler(event) {
        if (event.key === "Enter") {
            redirectSearch();
        }
    }

    function redirectSearch() {
        navigate('/search?q=' + encodeURIComponent(input));
    }

    const daQuery = searchParams.get("q") ?? '';

    return (
        <>
            <div className="Content">
                <div className="Main">
                    <label>
                        Search for:
                        <input type="text" onKeyUp={onKeyPressHandler} onChange={e => setInput(e.target.value)} value={input} name="myInput" />
                        <button className="FunkinButton" onClick={e => {
                            redirectSearch();
                        }}> Search </button>
                        
                    </label>
                    {daQuery.length > 0 ? (
                        <>
                            <br></br>
                            <br></br>
                            <h2>Searching for: "{daQuery}"</h2>
                            <ModSearchList query={daQuery}></ModSearchList>
                            <PlayerSearchList query={daQuery}></PlayerSearchList>
                            <SongSearchList query={daQuery}></SongSearchList>
                        </>
                    ): (<></>)}
                </div>
            </div>
        </>
    )
}

function SongSearchList(props) {
    const [data, setData] = useState([{
        id: '',
        fp: 0
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/search/songs?q=' + encodeURIComponent(props.query), { validateStatus: () => true });
                if (response.status !== 200) {
                    throw new Error(getResError(response));
                }
                const data = response.data;
                setError(null);
                setData(data);
                setLoading(false);
            } catch (error) {
                setError(error.toString());
                setLoading(false);
            }
        };

        setLoading(true);
        fetchData();
    }, [props.query]);

    let daSongs = [];
    if (!loading && !error) {
        for (const song of data) {
            const daNameSplit = song.id.split('-');
            daNameSplit.pop();
            daSongs.push(
                <div className="Coolbox">
                    <a href={"/song/" + encodeURIComponent(song.id) + '?strum=2'}>
                        <span>{daNameSplit.join(' ')}</span> <br></br>
                        <div style={{color: 
                            song.fp >= 50 ? 'crimson' : song.fp >= 20 ? 'violet' : song.fp >= 10 ? 'orange' : song.fp > 5 ? 'limegreen' : song.fp >= 1 ? 'white' : 'gray'
                        }}><span>{song.fp}FP</span></div>
                    </a>
                </div>
            );
        }
    }

    return (
        <>
            {loading ? (
                <h3>Fetching...</h3>
            ) : error ? (
                <h3>{error}</h3>
            ) : daSongs.length < 1 ? (
                <h3>No songs found!</h3>
            ) : (
                <>
                    <h3> Found Songs: </h3>
                    <div className="CenterFlex">
                        {daSongs}
                    </div>
                </>
            )}
        </>
    );
}

function PlayerSearchList(props) {
    const [data, setData] = useState([{
        name: '',
        role: '',
        points: 0,
        profileHue: 0,
        profileHue2: undefined
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/search/users?q=' + encodeURIComponent(props.query), { validateStatus: () => true });
                if (response.status !== 200) {
                    throw new Error(getResError(response));
                }
                const data = response.data;
                setError(null);
                setData(data);
                setLoading(false);
            } catch (error) {
                setError(error.toString());
                setLoading(false);
            }
        };

        setLoading(true);
        fetchData();
    }, [props.query]);

    let daUsers = [];
    if (!loading && !error) {
        for (const user of data) {
            daUsers.push(
                <div className="Coolbox">
                    <a href={"/user/" + encodeURIComponent(user.name)}>
                        {
                            user.role !== "Banned" ? (
                                <>
                                    <AvatarImg className='NetworkAvatar' src={getHost() + "/api/user/avatar/" + encodeURIComponent(user.name)}></AvatarImg>
                                    <br></br>
                                    <span>{user.name}</span>
                                    <br></br>
                                    {
                                        user.role ? <span>{user.role}</span> : <></>
                                    }
                                </>
                            ) :
                            (
                                <s> 
                                    <span>{user.name}</span>
                                    <br></br>
                                    <span>{user.role}</span>
                                </s>
                            )
                        }
                    </a>
                </div>
            );
        }
    }

    return (
        <>
            {loading ? (
                <h3>Fetching...</h3>
            ) : error ? (
                <h3>{error}</h3>
            ) : daUsers.length < 1 ? (
                <h3>No players found!</h3>
            ) : (
                <>
                    <h3> Found Players: </h3>
                    <div className="CenterFlex">
                        {daUsers}
                    </div>
                </>
            )}
        </>
    );
}

function ModSearchList(props) {
    const [data, setData] = useState([{
        id: '',
        images: [],
        title: '',
        keywords: []
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/search/mods?q=' + encodeURIComponent(props.query), { validateStatus: () => true });
                if (response.status !== 200) {
                    throw new Error(getResError(response));
                }
                const data = response.data;
                setError(null);
                setData(data);
                setLoading(false);
            } catch (error) {
                setError(error.toString());
                setLoading(false);
            }
        };

        setLoading(true);
        fetchData();
    }, [props.query]);

    let daMods = [];
    if (!loading && !error) {
        for (const mod of data) {
            daMods.push(
                <div className="RoundedContents" style={{
                    background: '#000000c0',
                    color: 'white',
                    width: '220px',
                }}>
                    <a href={"/mod/" + encodeURIComponent(mod.id)}>
                        <div className="ModImage" style={{
                            backgroundImage: 'url(' + mod.images[0] + ')',
                            minWidth: '220px',
                            minHeight: '125px',
                        }}> </div>
                    </a>
                    <div style={{
                        padding: '5px 8px 8px 8px'
                    }}>
                        <a href={"/mod/" + encodeURIComponent(mod.id)} style={{
                            lineHeight: '2',
                            color: 'white'
                        }}> {mod.title} </a>
                        <div className="ModGenericFlex" style={{
                            fontSize: '14px',
                            color: '#ffffffcb',
                            maxWidth: '100%'
                        }}>
                            <Keywords keywords={mod.keywords} take={5}></Keywords>
                        </div>
                    </div>
                </div>
            );
        }
    }

    return (
        <>
            {loading ? (
                <h3>Fetching...</h3>
            ) : error ? (
                <h3>{error}</h3>
            ) : daMods.length < 1 ? (
                <h3>No mods found!</h3>
            ) : (
                <>
                    <h3> Found Mods: </h3>
                    <div className="ModGenericFlex">
                        {daMods}
                    </div>
                </>
            )}
        </>
    );
}

export default Search;