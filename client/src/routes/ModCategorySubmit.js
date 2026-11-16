import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasAccess } from "../Util";
import axios from "axios";
import { getHost } from "../Util";
import Cookies from 'js-cookie';
import { ModCategorySelect } from "../components";

function ModCategorySubmit() {
  return (
    <>
      <ModCategoryCreate></ModCategoryCreate>
      <ModCategoryUpdate></ModCategoryUpdate>
    </>
  )
}

function ModCategoryUpdate(props) {
  const navigate = useNavigate();

  const [categoryID, setCategoryID] = useState('');

  const [name, setName] = useState('');
  const [description, setDesc] = useState('');
  const [hue, setHue] = useState(0);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(getHost() + '/api/mod/categories/' + categoryID, {
          headers: {
            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
          },
          responseType: 'json', transformResponse: (body) => {
            try { return JSON.parse(body) } catch (exc) { return body; }
          }, validateStatus: () => true
        });

        if (response.status !== 200) {
          throw new Error(typeof response.data == "object" ? response.data : response.data);
        }

        setName(response.data.name);
        setDesc(response.data.description);
        setHue(response.data.hue);
      }
      catch (error) {
        alert(error.message)
      }
    })();
  }, [categoryID]);

  useEffect(() => {
    if (!hasAccess('/api/mod/category/update'))
      navigate('/mods');
  }, []);
  if (!hasAccess('/api/mod/category/update'))
    return (<></>)

  async function submitData() {
    setLoading(true);

    try {
      const response = await axios.post(getHost() + '/api/mod/category/update', {
        id: categoryID,
        name: name.trim(),
        description: description.trim(),
        hue: hue,
      }, {
        headers: {
          'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
        },
        responseType: 'json', transformResponse: (body) => {
          try { return JSON.parse(body) } catch (exc) { return body; }
        }, validateStatus: () => true
      });

      if (response.status !== 200) {
        throw new Error(typeof response.data == "object" ? response.data : response.data);
      }

      alert('Mod Category updated successfully!')
      navigate('/mods/');
    }
    catch (error) {
      alert(error.message)
    }

    setLoading(false);
  }

  return <>
    <div className='Content'>
        <div className="Main">
          <p> Edit a Mod Category </p>
          <b>Category: </b> <ModCategorySelect v={categoryID} onSelect={sel => {
            setCategoryID(sel);
          }} />
          <br></br>
          <b> Name: </b> <input type="text" onChange={e => setName(e.target.value)} value={name} /> <br></br>
          <br></br>
          <b> Description: </b> <br></br>
          <textarea style={{ width: "500px", height: "200px", fontSize: '16px' }} className="SeamlessInput" value={description} onChange={e => {
            setDesc(e.target.value);
          }}></textarea>
          <br></br>
          <input class="HueSlider" id='ProfileColorSlider' type="range" min="0" max="360" value={hue} onInput={e => {
            setHue(Number(e.target.value));
          }} />
          <label for="avatar"> Upload Category Icon Here: 64x64px </label>
          <br></br>
          <input type="file" id="avatar" name="avatar" accept="image/png, image/jpeg" onChange={async e => {
            const file = e.target.files[0];

            const formData = new FormData();
            formData.append('file', file);

            try {
              const response = await axios.post(getHost() + '/api/mod/category/icon?id=' + encodeURIComponent(categoryID), formData, {
                headers: {
                  'content-type': 'multipart/form-data',
                  'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken')),
                },
                responseType: 'json', transformResponse: (body) => {
                  try { return JSON.parse(body) } catch (exc) { return body; }
                }, validateStatus: () => true
              });

              if (response.status === 200) {
                alert('Icon Uploaded!');
                window.location.reload();
              }
              else {
                alert(response.data);
              }
            } catch (error) {
              alert(error.message);
            }
          }} />
          <br></br>
          <br></br>
          {
            loading ? <>
              Loading...
            </> : <>
              <button className="FunkinButton" onClick={e => {
                submitData();
              }}> Update </button>
            </>
          }
        </div>
      </div>
  </>
}

function ModCategoryCreate(props) {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasAccess('/api/mod/category/create'))
      navigate('/mods');
  }, []);
  if (!hasAccess('/api/mod/category/create'))
    return (<></>)

  async function submitData() {
    setLoading(true);

    try {
      const response = await axios.post(getHost() + '/api/mod/category/create', {
        name: name.trim(),
        description: desc.trim(),
      }, {
        headers: {
          'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
        },
        responseType: 'json', transformResponse: (body) => {
          try { return JSON.parse(body) } catch (exc) { return body; }
        }, validateStatus: () => true
      });

      if (response.status !== 200) {
        throw new Error(typeof response.data == "object" ? response.data : response.data);
      }

      alert('Mod Category submitted successfully!')
      navigate('/mods/submitcategory');
    }
    catch (error) {
      alert(error.message)
    }

    setLoading(false);
  }

  return <>
      <div className='Content'>
        <div className="Main">
          <p> Create a new Mod Category </p>
          <b> Name: </b> <input type="text" onChange={e => setName(e.target.value)} value={name} /> <br></br>
          <br></br>
          <b> Description: </b> <br></br>
          <textarea style={{ width: "500px", height: "200px", fontSize: '16px' }} className="SeamlessInput" value={desc} onChange={e => {
            setDesc(e.target.value);
          }}></textarea>
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
  </>
}

export default ModCategorySubmit;