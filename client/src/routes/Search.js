import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHost, getResError } from "../Util";
import AvatarImg from "../AvatarImg";

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
                        Search for: <input onKeyUp={onKeyPressHandler} onChange={e => setInput(e.target.value)} value={input} name="myInput" />
                        <button onClick={e => {
                            redirectSearch();
                        }}> Search </button>
                        
                    </label>
                    {daQuery.length > 0 ? (
                        <>
                            <br></br>
                            <br></br>
                            <h2>Searching for: {daQuery}</h2>
                            <hr></hr>
                            <PlayerSearchList query={daQuery}></PlayerSearchList>
                            <hr></hr>
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
                <span>Fetching...</span>
            ) : error ? (
                <span>{error}</span>
            ) : daSongs.length < 1 ? (
                <span>No songs found!</span>
            ) : (
                <>
                    <p> Found Songs: </p>
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
        profileHue: 0
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
                                    <AvatarImg className='NetworkAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(user.name)}></AvatarImg>
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
                <span>Fetching...</span>
            ) : error ? (
                <span>{error}</span>
            ) : daUsers.length < 1 ? (
                <span>No players found!</span>
            ) : (
                <>
                    <p> Found Players: </p>
                    <div className="CenterFlex">
                        {daUsers}
                    </div>
                </>
            )}
        </>
    );
}

export default Search;