function AvatarImg(props) {
    var onFailAvatar = (image) => {
        image.currentTarget.src = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf' + (Math.round(Math.random() + 1)) + '.png';
    };

    return (
        <img className={props.className ? props.className : 'Avatar'} onError={onFailAvatar} alt='' src={props.src} ></img>
    )
}

export default AvatarImg;