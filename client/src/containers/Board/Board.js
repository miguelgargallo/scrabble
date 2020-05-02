import React from 'react';
import { toast } from 'react-toastify';
import { piecesWeight } from '../../helpers/definitions';

class Board extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            blankPiece: '',
            swappable: true,
            currentPiece: null,
            isBoardDrag: false,
        }
    }

    populateModal = (pieces) => {
        // Create container element
        let piecesContainer = document.createElement('div');
        piecesContainer.setAttribute('class', 'bagPieceContainer');

        // Create the pieces and eventually append to the parent
        // container. State/props has them as an array
        for (const letter of Object.keys(pieces)) {
            let piece;

            let pieceCont = document.createElement('div');
            pieceCont.setAttribute('class', 'bagPieceItem');

            piece = `<div class='piece'><span class="letter">${letter}</span></div>`;
            pieceCont.innerHTML = piece;

            // Add click event listener to all, signifying choice of transformation
            // of blank piece
            pieceCont.addEventListener('click', () => {
                this.setState({ blankPiece: pieceCont.firstChild.firstChild.innerText });
                this.toggleSelectionModal();
            });

            piecesContainer.appendChild(pieceCont);
        }
        document.getElementById('selectionHome').appendChild(piecesContainer);
    }

    toggleSelectionModal = () => {
        // Actually show (toggle) modal
        document.getElementById('selectionModal').classList.toggle('is-active');
    }

    getTilePositionOnBoard = (tile) => {
        // All the tiles on the board
        const boardTiles = document.querySelectorAll('.tile');

        // For each tile on the board, get the one that matches
        // the passed tile
        return [].indexOf.call(boardTiles, tile);
    }

    populateBoard = (e, p) => {
        let bp = document.createElement('div');
        bp.setAttribute('id', `jp_${p}`);
        bp.setAttribute('class', 'bp');
        bp.innerHTML = e;
        document.querySelectorAll('.tile')[p].appendChild(bp);
    }

    // Callback to handle sio events
    updatePlay = (data) => {
        // For events that happen when a piece is moved from one
        // position on the board to another. Exclude thyself
        if (data.eventType === 'drag') {
            if (data.name !== this.props.name) {
                let playedPiece = document.querySelector(`#${data.id}`);
                if (playedPiece !== null) {
                    playedPiece.remove();
                }
            }
        }
        else if (data.eventType === 'rackToBoard') {
            if (data.name !== this.props.name) {
                this.populateBoard(data.elementString, data.elementPosition);
            }
        }
        else if (data.eventType === 'bagNearEmpty') {
            // Announce only once
            if (this.state.swappable) {
                this.setState({ swappable: false });
                toast.warn(data.message);
            }
        }
        // Implicit updateBlank. Expand as needed
        else {
            document.getElementById(data.id).firstChild.firstChild.innerText = data.pieceLetter;
        }
    }

    updateBlankPiece = (id) => {
        if (this.state.blankPiece === '') {
            setTimeout(() => {
                this.updateBlankPiece(id);
            }, 200);
        }
        else {
            // Emit to everybody and then reset
            let pieceLetter = this.state.blankPiece;
            this.props.socket.emit('inPlayEvent', {
                roomID: this.props.roomID,
                pieceLetter: pieceLetter,
                eventType: 'updateBlank',
                id: id,
            });
            this.setState({ blankPiece: '' });
        }
    }

    componentDidMount = () => {
        // Populate the selectionModal
        this.populateModal(piecesWeight);

        /* Events fired on the drag target */

        // When a piece is initially moved, from rack or board
        document.addEventListener("dragstart", (event) => {
            if (this.props.isTurn && !this.props.gameEnded) {
                try {
                    let cL = [...event.target.classList]
                    if (cL.includes('pieceContainer') || cL.includes('bp')) {
                        // A piece having a classname with 'bp' is originated
                        // from the board itself, signifying a drag
                        if (cL.includes('bp')) {
                            this.setState({ isBoardDrag: true });
                        }
                        this.setState({ currentPiece: event.target });
                    }
                } catch (error) {
                    toast.error(`Invalid drag motion.`);
                }
            }
            else {
                if (this.props.gameEnded) {
                    toast.error("The game has ended. No moves are valid.");
                    return;
                }
                // If it's a drag that's associated with a scrabble piece. Warn to wait
                if (event.target.getAttribute('draggable')) {
                    toast.error(`It's not your turn, ${this.props.name}. Kindly wait your turn.`);
                }
                
            }
        });

        /* Events fired on the drop target */

        // When the draggable element enters the droptarget, change the border style
        document.addEventListener("dragenter", (event) => {
            event.preventDefault();
            if (this.props.isTurn && !this.props.gameEnded) {
                if (event.target.className.includes('droppable')) {
                    event.target.style.border = "0.4px solid yellow";
                }
            }
        });

        // By default, data/elements cannot be dropped in other elements. 
        // To allow a drop, we must prevent the default handling of the element
        document.addEventListener("dragover", (event) => {
            event.preventDefault();
        });

        // When the draggable element leaves the droptarget, reset the style
        document.addEventListener("dragleave", (event) => {
            if (this.props.isTurn && !this.props.gameEnded) {
                event.target.removeAttribute('style');
            }
        });

        document.addEventListener("drop", (event) => {
            event.preventDefault();
            if (this.props.isTurn && !this.props.gameEnded) {
                event.target.removeAttribute('style'); //  Reset the border
                let piece = this.state.currentPiece;
                if (event.target.className.includes('droppable') && piece !== null) {
                    let cL = [...piece.classList]
                    // Register only for valid movements. Avoid stuff like
                    // a mistakenly-made drag or a bare tile drag
                    if (cL.includes('pieceContainer') || cL.includes('bp')) {
                        // Get the position of the tile the piece was dropped in
                        let piecePosition = this.getTilePositionOnBoard(event.target);

                        // Make a new parent element with a custom class and duplicate the
                        // contents of the current piece to it, and then add it as a child 
                        // to the tile where it is placed
                        let bp = document.createElement('div');
                        bp.setAttribute('draggable', 'true');
                        bp.setAttribute('id', `jp_${piecePosition}`);
                        bp.setAttribute('class', 'bp');

                        // Piece is a blank? 
                        if (piece.firstChild.firstChild.innerText === "") {
                            // Show modal for selection
                            this.toggleSelectionModal();
                            this.updateBlankPiece(`jp_${piecePosition}`);
                        }

                        // Make piece appear on board
                        bp.innerHTML = piece.innerHTML;
                        event.target.appendChild(bp);

                        // If it's a board drag i.e the user is shifting the position of the
                        // piece whilst still playing on the board
                        if (this.state.isBoardDrag) {
                            let children = piece.parentNode.children; // Get all the children of the source tile
                            // Special tiles (dL, tW, etc) will have more than one children (one for the actual message and
                            // the other for the piece that was previously on it). Normal tiles will have just one child.
                            // We want to remove the just the piece from the tile. So, get an index based on the length of the children.
                            let index = children.length === 1 ? 0 : 1;
                            // Remove appropriately
                            piece.parentNode.removeChild(children[index]);

                            // Reset 
                            this.setState({ isBoardDrag: false });

                            // Reflect on other players' boards 
                            // that a board-drag happened
                            this.props.socket.emit('inPlayEvent', {
                                roomID: this.props.roomID,
                                name: this.props.name,
                                eventType: 'drag',
                                id: piece.id,
                            });
                        }
                        // Implicit movement of tile from rack to board
                        else {
                            // The rack pieces can be deleted, as they have been duplicated on the board
                            let prevPiece = document.getElementById(piece.id);
                            if (prevPiece) { prevPiece.remove() };
                        }
                        // Reflect on other players' boards that a rack-event
                        // happened
                        this.props.socket.emit('inPlayEvent', {
                            name: this.props.name,
                            eventType: 'rackToBoard',
                            roomID: this.props.roomID,
                            elementString: bp.innerHTML,
                            elementPosition: piecePosition
                        });
                        // Reset
                        this.setState({ currentPiece: null });
                    }
                }
            }
        });

        /* Register Socket.io Event Listener */

        // Replicate the play event, regardless of the type
        this.props.socket.on('inPlay', (data) => {
            this.updatePlay(data);
        });
    }

    render() {
        return (
            <div className='boardContainer'>
                <div id="selectionModal" className="modal">
                    <div className="modal-background"></div>
                    <div className="modal-card bagItems">
                        <section id="selectionHome" className="modal-card-body">
                            <div className="centralize title is-4"><p>Choose Letter</p></div>
                        </section>
                    </div>
                </div>
                <div className="board">
                    <div className='row'>
                        <div className="droppable tile tW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tW">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile tW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW cT">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tW">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dW">
                        </div>
                        <div className="droppable tile">
                        </div>
                    </div>
                    <div className='row'>
                        <div className="droppable tile tW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tW">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile dL">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile">
                        </div>
                        <div className="droppable tile tW">
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default Board;
