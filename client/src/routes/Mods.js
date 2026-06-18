import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHost, getResError, hasAccess } from "../Util";
import { Keywords } from "./Mod";
import { Icon } from "@iconify/react/dist/iconify.js";
import { ModsSortSelect } from "../components";

function Mods() {
    const [searchParams] = useSearchParams();
    const [input, setInput] = useState('');
    const navigate = useNavigate();

    function onKeyPressHandler(event) {
        if (event.key === "Enter") {
            redirectSearch();
        }
    }

    function redirectSearch() {
        navigate('/mods' + (input.length > 0 ? '?q=' + encodeURIComponent(input) : ''));
    }

    const daQuery = searchParams.get("q") ?? '';

    return (
        <>
            <div className="Content">
                <div className="Main">
                    <h3> Mods </h3>
                    Search for:
                    <input type="text" onKeyUp={onKeyPressHandler} onChange={e => setInput(e.target.value)} value={input} name="myInput" />
                    <button className="FunkinButton" onClick={e => {
                        redirectSearch();
                    }}> Search </button>
                    <br></br>
                    <br></br>
                    <ModSearchList query={daQuery}></ModSearchList>
                </div>
            </div>
        </>
    )
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
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Number.parseInt(searchParams.get('page') ?? '0');
    const sort = searchParams.get('sort');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/search/mods?q=' + encodeURIComponent(props.query) + "&page=" + page + (searchParams.has('sort') ? '&sort=' + sort : ''), { validateStatus: () => true });
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
    }, [props.query, page, sort]);

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
                <span>Fetching...</span>
            ) : error ? (
                <span>{error}</span>
            ) : (
                <>
                    {daMods.length < 1 ? (
                        <span>No mods found!</span>
                    ) : <div className="ModGenericFlex">
                        {daMods}
                    </div>}
                    <br></br>
                    <center>
                    Sort: <ModsSortSelect v={searchParams.get('sort')} onSelect={(sel) => {
                        searchParams.set('sort', sel);
                        if (!sel)
                            searchParams.delete('sort');
                        setSearchParams(searchParams);
                    }} />
                    </center>
                    {(page > 0) ?
                    <button className='SvgButton' style={{float: 'left'}} onClick={() => {
                        searchParams.set('page', page - 1);
                        setSearchParams(searchParams);
                    }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                    : <></>}
                    {(data.length === 15) ?
                    <button className='SvgButton' style={{float: 'right'}} onClick={() => {
                        searchParams.set('page', page + 1);
                        setSearchParams(searchParams);
                    }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                    : <></>}
                    <br></br>
                    <center>
                    {hasAccess('/api/mod/submit') ? <>
                        <a href="/mods/submit" title="Submit New Mod">
                        <button className='SvgButton'> <Icon width={20} icon="material-symbols:add" /> </button>
                        </a>
                    </> : <></>}
                    </center>
                </>
            )}
        </>
    );
}

export default Mods;