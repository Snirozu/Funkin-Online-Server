import axios from "axios";
import { useEffect, useState } from "react";
import { getHost, hasAccess, parseYouTubeURL, textProfileColor, timeAgo } from "../Util";
import Cookies from 'js-cookie';
import { Icon } from "@iconify/react/dist/iconify.js";
import Popup from "reactjs-popup";
import Linkify from "linkify-react";
import { Popover } from 'react-tiny-popover'
import { EmojiPicker } from "frimousse";

function Comments(params) {
    const [commentsData, setCommentsData] = useState({
        count: 0,
        comments: [{
            id: '',
            content: '',
            by: '',
            byHue: 0,
            on: null,
            submitted: '',
            reactions: [{
                name: '',
                usersIDs: []
            }]
        }]
    });
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [commentsError, setCommentsError] = useState(null);

    const [commentsPage, setCommentsPage] = useState(0);

    const [emojiPickerTarget, setEmojiPickerTarget] = useState(null);

    const renderLink = ({ attributes, content }) => {
        if (/\.(jpeg|jpg|gif|png|webp)$/i.test(content)) {
            return <img src={content} style={{maxHeight: '100px'}} alt="(Image)"/>;
        }
        const youtubeUrl = parseYouTubeURL(content);
        if (youtubeUrl) {
            return <iframe width="560" height="315" src={"https://www.youtube-nocookie.com/embed/" + youtubeUrl.videoId + "?amp;start=" + (youtubeUrl.timestamp ?? 0)} title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        }
        return <a rel="noreferrer" target="_blank" href={attributes.href}>{content}</a>;
    };

    const fetchCommentsData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/' + params.type + '/comments/' + encodeURIComponent(params.id) + '?page=' + commentsPage, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }, responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return body; }
                }, validateStatus: () => true,
            });
            if (response.status !== 200) {
                throw new Error(typeof response.data == "object" ? response.data.error : response.data);
            }

            setCommentsError(null);
            setCommentsData(response.data);
            setCommentsLoading(false);
        } catch (error) {
            setCommentsError(error.message);
            setCommentsLoading(false);
        }
    };

    useEffect(() => {
        fetchCommentsData();
    }, [commentsPage]);
    
    function SubmitComment() {
        const [content, setContent] = useState('');
        const [postStatus, setPostStatus] = useState(undefined);

        return (
            <div className='Content'>
                <div style={{textAlign: 'center'}}>
                    <h2>
                        Post a comment:
                    </h2>
                    <label>
                        <textarea style={{fontSize: '18px'}} className="SeamlessInput" value={content} onChange={e => {
                            setContent(e.target.value);
                        }}></textarea>
                    </label>
                    <br></br>
                    {
                        !postStatus ?
                            <button onClick={async () => {
                                setPostStatus('Posting...');
                                try {
                                    const response = await axios.post(getHost() + "/api/" + params.type + "/comment/post", {
                                        id: params.id,
                                        content: content
                                    }, {
                                        headers: {
                                            'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                                        },
                                        responseType: 'json', transformResponse: (body) => {
                                            try { return JSON.parse(body) } catch (exc) { return null; }
                                        }, validateStatus: () => true
                                    });

                                    if (response.status !== 200) {
                                        setPostStatus(undefined);
                                        throw response.data.error;
                                    }
                                    setPostStatus('Posted!');
                                    window.location.reload();
                                } catch (error) {
                                    setPostStatus(undefined);
                                    alert(error);
                                }
                            }}> Submit </button>
                        : <> {postStatus} </>
                    }
                </div>
            </div>
        );
    }
    
    let comments = [];
    for (const commentData of commentsData.comments) {
        if (commentsLoading || !commentData)
            break;

        async function reactEmoji(emoji) {
            try {
                const response = await axios.post(getHost() + "/api/" + params.type + "/comment/react", {
                    name: emoji,
                    id: commentData.id
                }, {
                    headers: {
                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                    },
                    responseType: 'text', validateStatus: () => true
                });

                if (response.status !== 200) {
                    throw response.data;
                }
                fetchCommentsData();
            } catch (error) {
                alert(error);
            }
        }

        async function removeComment() {
            try {
                const response = await axios.get(getHost() + "/api/" + params.type + "/comment/remove?id=" + encodeURIComponent(commentData.id), {
                    headers: {
                        'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                    },
                    responseType: 'text', validateStatus: () => true
                });

                if (response.status !== 200) {
                    throw response.data;
                }
                fetchCommentsData();
            } catch (error) {
                alert(error);
            }
        }

        const reactions = [];

        if (commentData?.reactions)
            for (const reaction of commentData.reactions) {
                reactions.push(
                    <div className="Reaction" title={reaction.usersIDs.join(', ') + " reacted"} onClick={_ => {
                        reactEmoji(reaction.name);
                    }}>
                        <span onClick={_ => {
                            reactEmoji(reaction.name);
                        }}> {reaction.name} </span>
                        <span> {reaction.usersIDs.length} </span>
                    </div>
                );
            }

        console.log(commentData.byHue[0]);

        comments.push(<div>
            <div className="CommentBox">
                <div className="CommentHeader">
                    <img alt="" width={30} src={"https://funkin.sniro.boo/api/user/avatar/" + encodeURIComponent(commentData.by)}></img>
                    <div>
                        <a href={'/user/' + commentData.by} style={{
                            color: textProfileColor(commentData.byHue[0]),
                        }}> {commentData.by} </a>
                        <span className="TimeAgoText"> {timeAgo.format(Date.parse(commentData.submitted))} </span>
                    </div>
                    {
                        Cookies.get('username') === commentData.by || hasAccess('admin.' + params.type + '.comment.remove') ?
                            <span className="SmallTextButton" onClick={() => {
                                if (window.confirm('Are you sure?')) {
                                    removeComment();
                                }
                            }}>(Delete)</span> 
                        : <></>
                    }
                </div>
                <span className="CommentContent">
                    <Linkify options={{render: renderLink}}>
                        {commentData.content}
                    </Linkify>
                </span>
                <div className="ReactionsBox">
                    {reactions}
                    {
                        Cookies.get('authid') ? 
                            <Popover
                                isOpen={emojiPickerTarget === commentData.id}
                                onClickOutside={() => setEmojiPickerTarget(null)}
                                positions={['top', 'bottom', 'left', 'right']}
                                content={
                                    <EmojiPicker.Root onEmojiSelect={async e => {
                                        reactEmoji(e.emoji);
                                        setEmojiPickerTarget(null);
                                    }}>
                                    <EmojiPicker.Search />
                                    <EmojiPicker.Viewport>
                                        <EmojiPicker.Loading>Loading…</EmojiPicker.Loading>
                                        <EmojiPicker.Empty>No emoji found.</EmojiPicker.Empty>
                                        <EmojiPicker.List />
                                    </EmojiPicker.Viewport>
                                    </EmojiPicker.Root>
                                }
                            >
                                <button className="AddReactionButton" title={"React to this comment!"} onClick={() => setEmojiPickerTarget(commentData.id)}>
                                    <Icon width={18} icon="material-symbols:add-reaction-outline" />
                                </button>
                            </Popover>
                    : <></>}
                </div>
            </div>
        </div>);
    }

    return <>
        <div className="Comments" style={{
            display: 'flex'
        }}>
            <p> Comments ({commentsData.count}) </p>
            {
                Cookies.get('authid') ? <div style={{
                    marginLeft: '10px'
                }}>
                    <Popup trigger={<button className='SvgButton'> <Icon width={20} icon="mdi:add" /> </button>} modal>
                        <SubmitComment></SubmitComment>
                    </Popup>
                </div>
                : <></>
            }
            <div style={{
                display: 'flex',
                marginLeft: 'auto',
                alignItems: 'center',
                gap: '5px'
            }}>
            {(commentsPage > 0) ?
                <button className='SvgButton' style={{ float: 'left' }} onClick={() => {
                    setCommentsPage(commentsPage - 1);
                }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                : <></>}
            <span> Page {commentsPage + 1} of {Math.floor(commentsData.count / 10 + 1)} </span>
            {(Math.floor(commentsData.count / 10) > commentsPage) ?
                <button className='SvgButton' style={{ float: 'right' }} onClick={() => {
                    setCommentsPage(commentsPage + 1);
                }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                : <></>}
            </div>

        </div>
        {comments.length < 1 ? <>
            <span className="SmallText"> No comments. </span>
            <br></br>
        </> : comments}
    </>
}

export default Comments;