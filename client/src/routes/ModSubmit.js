import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasAccess } from "../Util";
import axios from "axios";
import { getHost } from "../Util";
import Cookies from 'js-cookie';

function ModSubmit() {
    const navigate = useNavigate();

    const [id, _setID] = useState('');
    function setID(v) {
        v = String(v).toLowerCase().replaceAll(' ', '_').trim();
        _setID(v);
    }
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [keywords, setKeywords] = useState('');
    const [images, setImages] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!hasAccess('/api/mod/submit'))
            navigate('/search');
    }, []);
    if (!hasAccess('/api/mod/submit'))
        return ( <></> )

    async function submitData() {
        setLoading(true);

        try {
            if (!window.confirm('The ID cannot be changed after Mod submission.\nDo you want to proceed?'))
                return;

            const response = await axios.post(getHost() + '/api/mod/submit', {
                id: id.trim(),
                title: title.trim(),
                description: desc.trim(),
                keywords: keywords.trim().split(' '),
                images: images.trim().split('\n'),
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

            alert('Mod submitted successfully!')
            navigate('/mod/' + encodeURIComponent(id));
        } 
        catch (error) {
            alert(error.message)
        }

        setLoading(false);
    }

    return (
        <div className='Content'>
            <div className="Main">
                <p> Submit a new Mod </p>
                <b> ID: </b> <input type="text" onChange={e => setID(e.target.value)} value={id} /> <br></br>
                The URL will look like: <br></br>
                https://funkin.sniro.boo/mod/<b>{encodeURIComponent(id)}</b> <br></br>
                <b style={{ color: 'red' }}> THE ID CANNOT BE CHANGED </b>
                <br></br>
                <br></br>
                <b> Title: </b> <input type="text" onChange={e => setTitle(e.target.value)} value={title} /> <br></br>
                <br></br>
                <b> Description: </b> <br></br>
                (Would be nice to have information about the mod and credits to the authors)
                <br></br>
                <textarea style={{ width: "500px", height: "200px", fontSize: '16px'}} className="SeamlessInput" value={desc} onChange={e => {
                    setDesc(e.target.value);
                }}></textarea>
                <br></br>
                <b> Keywords: </b> <input type="text" onChange={e => setKeywords(e.target.value)} value={keywords} /> <br></br>
                (Search Keywords, separate with a space)
                <br></br>
                <br></br>
                <b> Images: </b>
                <br></br>
                (Input Image URLs here, separate by a new line) <br></br>
                (The first entry will be the thumbnail)
                <br></br>
                <textarea style={{ width: "500px", height: "100px", fontSize: '12px'}} className="SeamlessInput" value={images} onChange={e => {
                    setImages(e.target.value);
                }}></textarea>
                <br></br>
                (Downloads will be possible to add once the mod has been submitted.)
                <br></br>
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

export default ModSubmit;