import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHost, getResError, hasAccess } from "../Util";
import { Keywords } from "./Mod";
import { Icon } from "@iconify/react/dist/iconify.js";
import { ModCategorySelect, ModsSortSelect, VerifiedSelect } from "../components";

function Mods() {
    const [searchParams, setSearchParams] = useSearchParams();

    function onKeyPressHandler(event) {
        if (event.key === "Enter") {
            redirectSearch();
        }
    }
    const verified = searchParams.get('verified') === '1';
    const inputQuery = searchParams.get("q") ?? '';
    const [query, setQuery] = useState(searchParams.get("q") ?? '');
    function redirectSearch() {
        setQuery(inputQuery);
    }

    const [dataCategories, setDataCategories] = useState([{
        id: '',
        name: '',
        description: '',
        icon: '',
        _count: {
            mods: 0
        }
    }]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/mod/categories');
                if (response.status !== 200) {
                    throw new Error(getResError(response));
                }
                const data = response.data;
                setErrorCategories(null);
                setDataCategories(data);
                setLoadingCategories(false);
            } catch (error) {
                setDataCategories(error.toString());
                setLoadingCategories(false);
            }
        };

        setLoadingCategories(true);
        fetchData();
    }, []);

    const categoryList = [];

    for (const category of dataCategories) {
        categoryList.push(<li> {category.name} ({category._count.mods}) </li>);
    }

    return (
        <>
            {/* <div className="Content">
                <div className="Main">
                    <h3>Category</h3>
                    <ul>
                        {categoryList}
                    </ul>
                </div>
            </div> */}
            <div className="Content">
                <div className="Main">
                    <h3> Mods </h3>
                    Search for: &nbsp;
                    <input type="text" onKeyUp={onKeyPressHandler} onChange={e => {
                        searchParams.set('q', e.target.value);
                        if (searchParams.get('q').length == 0)
                            searchParams.delete('q');
                        setSearchParams(searchParams);
                    }} value={inputQuery} name="myInput" />
                    &nbsp;
                    <button className="FunkinButton" style={{
                        marginBottom: '5px'
                    }} onClick={e => {
                        redirectSearch();
                    }}> Search </button>
                    <br></br>
                    <center>
                    <b>Sort: </b><ModsSortSelect v={searchParams.get('sort')} onSelect={(sel) => {
                        searchParams.set('sort', sel);
                        if (!sel)
                            searchParams.delete('sort');
                        setSearchParams(searchParams);
                    }} />
                    &nbsp;
                    &nbsp;
                    <b>Category: </b> <ModCategorySelect v={searchParams.get('category')} onSelect={sel => {
                        searchParams.set('category', sel);
                        if (!sel)
                            searchParams.delete('category');
                        setSearchParams(searchParams);
                    }} />
                    <br></br>
                    <b>Status: </b>
                    <VerifiedSelect v={searchParams.get('verified')} onSelect={v => {
                        searchParams.set('verified', v);
                        if (!v)
                            searchParams.delete('verified');
                        setSearchParams(searchParams);
                    }}></VerifiedSelect>
                    </center>
                    <br></br>
                    <ModSearchList query={query}></ModSearchList>
                </div>
            </div>
        </>
    )
}

function ModSearchList(props) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState([{
        id: '',
        images: [],
        title: '',
        keywords: [],
        downloadHits: 0,
        favoritedCount: 0,
        category: {
            name: '',
            id: ''
        },
        verified: false,
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const page = Number.parseInt(searchParams.get('page') ?? '0');
    const sort = searchParams.get('sort');
    const category = searchParams.get('category');
    const verified = searchParams.get('verified');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(getHost() + '/api/search/mods?q=' + encodeURIComponent(props.query) + "&page=" + page + (searchParams.has('sort') ? '&sort=' + sort : '') + (searchParams.has('category') ? '&category=' + category : '') + (verified ? '&verified=' + verified : ''), { validateStatus: () => true });
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
    }, [props.query, page, sort, category, verified]);

    let daMods = [];
    if (!loading && !error) {
        for (const mod of data) {
            daMods.push(
                <div className="RoundedContents ModSearchItem" style={{
                    background: '#000000c0',
                    color: 'white',
                    width: '220px',
                }}>
                    <a href={"/mod/" + encodeURIComponent(mod.id)}>
                        <div className="ModImage" style={{
                            backgroundImage: 'url(' + mod.images[0] + ')',
                            width: '220px',
                            height: '125px',
                            justifyContent: 'center',
                            alignContent: 'center',
                        }}>
                            {!mod.verified ? <>
                                <div style={{
                                    display: 'flex',
                                    backdropFilter: 'blur(10px)',
                                    height: '100%',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        background: '#5a410b',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        color: 'white'
                                    }}>
                                        <span> ⚠ Not Verified! ⚠ </span>
                                    </div>
                                </div>
                            </> : <></>}
                        </div>
                    </a>
                    <div style={{
                        padding: '5px 8px 8px 8px'
                    }}>
                        <a href={"/mod/" + encodeURIComponent(mod.id)} style={{
                            lineHeight: '2',
                            color: 'white'
                        }}> {mod.title} </a>
                        <div className="Hoverable" style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.18)',
                            width: 'fit-content',
                            margin: 'auto',
                            marginBottom: '8px',
                            padding: '8px',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }} onClick={() => {
                            searchParams.set('category', mod.category.id);
                            if (!mod.category.id)
                                searchParams.delete('category');
                            setSearchParams(searchParams);
                        }} >
                            <img width={24} src={getHost() + '/api/mod/category/icon/' + mod.category.id} alt=""></img>
                            <span className="SmallText"> {mod.category.name} </span>
                        </div>
                        <div style={{
                            marginBottom: '10px',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '15px',
                            marginBottom: '15px'
                        }}>
                            <span className="SmallText">{mod.favoritedCount} <img style={{
                                    filter: '',
                                    borderRadius: '0',
                                    height: '14px',
                                }} src='/images/fav-tiny.png' alt=''></img> 
                            </span>

                            <span className="SmallText"> {Number.parseInt(mod.downloadHits).toLocaleString()} <img style={{
                                    filter: '',
                                    borderRadius: '0',
                                    height: '14px',
                                }} src='/images/dl-tiny.png' alt=''></img> 
                            </span>
                        </div>
                        <div className="ModGenericFlex" style={{
                            fontSize: '14px',
                            color: '#ffffffcb',
                            maxWidth: '100%',
                            justifyContent: 'center'
                        }}>
                            <Keywords keywords={mod.keywords} onClick={keyword => {
                                const inputQuery = (searchParams.get("q") ?? '');
                                if (!inputQuery.includes(keyword)) {
                                    searchParams.set("q", (inputQuery + ' ' + keyword).trim());
                                }
                                else {
                                    searchParams.set('q', (inputQuery.replaceAll(keyword, '').replaceAll('  ', ' ')).trim());
                                }
                                if (searchParams.get('q').length == 0)
                                    searchParams.delete('q');
                                setSearchParams(searchParams);
                            }} take={5}></Keywords>
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
                    ) : 
                    <div className="ModGenericFlex" style={{
                        justifyContent: 'center'
                    }}>
                        {daMods}
                    </div>
                    }
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